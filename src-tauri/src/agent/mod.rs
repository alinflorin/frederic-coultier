//! The agent side of the app: an MCP server whose tools drive the open project.

pub mod bridge;
pub mod chat;
pub mod cli;
pub mod server;
pub mod text;
pub mod tools;

use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{Manager, State};
use tokio::sync::Mutex;

use crate::rhino::Rhino;
use bridge::Bridge;

/// The server is for the app's own agent chat: it listens on this computer only, on a port the system picks.
const HOST: &str = "127.0.0.1";

/// Where the server is and how it is used.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub running: bool,
    pub url: Option<String>,
    pub error: Option<String>,
    /// The agent that connected last (its own name for itself), if any has.
    pub client: Option<String>,
    /// Seconds since an agent last connected or used a tool; `None` if none has.
    pub idle_secs: Option<u64>,
    /// Tool calls since the app started.
    pub calls: u64,
}

struct Inner {
    status: McpStatus,
    running: Option<server::Served>,
}

/// The MCP server the chat agents use.
pub struct Mcp {
    bridge: Arc<dyn Bridge>,
    rhino: Arc<Rhino>,
    /// What agents did since the app started: whether the instructions were read, and when they last called.
    gate: Arc<tools::Gate>,
    inner: Mutex<Inner>,
}

impl Mcp {
    pub fn new(bridge: Arc<dyn Bridge>, rhino: Arc<Rhino>) -> Self {
        let status = McpStatus { running: false, url: None, error: None, client: None, idle_secs: None, calls: 0 };
        Self {
            bridge,
            rhino,
            gate: Arc::new(tools::Gate::default()),
            inner: Mutex::new(Inner { status, running: None }),
        }
    }

    /// The manual for an agent that is given it up front: the user's notes and the `fc` reference.
    pub async fn instructions(&self) -> String {
        cli::Cli::new(self.bridge.clone(), self.rhino.clone()).instructions().await
    }

    pub async fn status(&self) -> McpStatus {
        let status = self.inner.lock().await.status.clone();
        self.with_activity(status)
    }

    fn with_activity(&self, mut status: McpStatus) -> McpStatus {
        let a = self.gate.activity();
        status.client = a.client;
        status.idle_secs = a.idle_secs;
        status.calls = a.calls;
        status
    }

    /// Starts listening (again). Never fails: a problem is reported in the returned status.
    pub async fn start(&self) -> McpStatus {
        let mut g = self.inner.lock().await;
        if let Some(mut old) = g.running.take() {
            old.stop.cancel();
            if tokio::time::timeout(Duration::from_secs(3), &mut old.task).await.is_err() {
                old.task.abort();
            }
        }
        let mut status = McpStatus { running: false, url: None, error: None, client: None, idle_secs: None, calls: 0 };
        match server::serve(self.bridge.clone(), self.rhino.clone(), HOST, 0, true, self.gate.clone()).await {
            Ok(served) => {
                status.url = Some(format!("http://{}:{}/mcp", served.addr.ip(), served.addr.port()));
                status.running = true;
                g.running = Some(served);
            }
            Err(e) => status.error = Some(format!("could not listen on {HOST}: {e}")),
        }
        g.status = status.clone();
        self.with_activity(status)
    }
}

#[tauri::command]
pub async fn mcp_status(mcp: State<'_, Arc<Mcp>>) -> Result<McpStatus, String> {
    Ok(mcp.status().await)
}

/// A search result for the knowledge base window.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KbHit {
    pub path: String,
    pub heading: String,
    pub start: usize,
    pub end: usize,
    pub snippet: String,
}

/// The best passages for a query, at most two per file.
#[tauri::command]
pub async fn kb_search(query: String) -> Vec<KbHit> {
    let index = cli::kb::baked()();
    let mut per_file = std::collections::HashMap::<usize, usize>::new();
    index
        .search(&query, &|_| true)
        .iter()
        .filter_map(|h| {
            let p = &index.passages[h.passage];
            let n = per_file.entry(p.doc).or_default();
            *n += 1;
            (*n <= 2).then(|| KbHit {
                path: index.docs[p.doc].rel.clone(),
                heading: p.heading.clone(),
                start: p.start,
                end: p.end,
                snippet: index.docs[p.doc].lines[p.start - 1..p.end.min(p.start + 5)].join("\n"),
            })
        })
        .take(30)
        .collect()
}

/// A whole file of the knowledge base.
#[tauri::command]
pub async fn kb_read(path: String) -> Result<String, String> {
    let index = cli::kb::baked()();
    Ok(cli::kb::find(&index.docs, &path)?.lines.join("\n"))
}

/// Starts the MCP server.
pub fn start(app: &tauri::AppHandle) {
    let pending = Arc::new(bridge::Pending::default());
    app.manage(pending.clone());
    let rhino = app.state::<Arc<Rhino>>().inner().clone();
    let mcp = Arc::new(Mcp::new(Arc::new(bridge::TauriBridge::new(app.clone(), pending)), rhino));
    app.manage(mcp.clone());

    // started before the window exists, so the chat can use it from the start
    let status = tauri::async_runtime::block_on(mcp.start());
    match (&status.url, &status.error) {
        (Some(url), _) => eprintln!("MCP server (internal): {url}"),
        (_, Some(e)) => eprintln!("MCP server not started: {e}"),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use bridge::mock::Mock;

    fn mcp() -> Mcp {
        Mcp::new(Mock::new(|_, _| Ok(json!({}))), Arc::new(Rhino::new("127.0.0.1", 1, std::env::temp_dir())))
    }

    #[tokio::test]
    async fn listens_on_loopback_only_on_a_port_of_its_own() {
        let m = mcp();
        let s = m.start().await;
        assert!(s.running && s.error.is_none(), "{s:?}");
        let url = s.url.clone().unwrap();
        assert!(url.starts_with("http://127.0.0.1:") && url.ends_with("/mcp"), "{url}");
        let port: u16 = url["http://127.0.0.1:".len()..url.len() - 4].parse().unwrap();
        assert!(tokio::net::TcpStream::connect(("127.0.0.1", port)).await.is_ok());
        assert_eq!(m.status().await, s);
    }

    #[tokio::test]
    async fn restarting_releases_the_old_port() {
        let m = mcp();
        let a = m.start().await.url.unwrap();
        let b = m.start().await.url.unwrap();
        let port = |u: &str| u["http://127.0.0.1:".len()..u.len() - 4].parse::<u16>().unwrap();
        assert!(tokio::net::TcpStream::connect(("127.0.0.1", port(&b))).await.is_ok());
        if port(&a) != port(&b) {
            assert!(tokio::net::TcpStream::connect(("127.0.0.1", port(&a))).await.is_err());
        }
    }
}
