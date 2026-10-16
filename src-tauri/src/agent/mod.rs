//! The agent side of the app: an MCP server whose tools drive the open project.

pub mod bridge;
pub mod cli;
pub mod server;
pub mod text;
pub mod tools;

use std::net::IpAddr;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use serde::Serialize;
use tauri::{Manager, State};
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

use bridge::Bridge;

pub const DEFAULT_HOST: &str = "127.0.0.1";
pub const DEFAULT_PORT: u16 = 45555;

/// Where the server is, for the preferences window.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub running: bool,
    pub host: String,
    pub port: u16,
    pub url: Option<String>,
    pub error: Option<String>,
    /// Only programs on this computer can connect.
    pub loopback: bool,
}

fn is_loopback(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost") || host.parse::<IpAddr>().is_ok_and(|a| a.is_loopback())
}

fn check(host: &str, port: u16) -> Result<(), String> {
    if host.is_empty()
        || host.len() > 253
        || !host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':'))
    {
        return Err(format!(
            "{host:?} is not a host name or address; use something like {DEFAULT_HOST}"
        ));
    }
    if port == 0 {
        return Err("the port must be between 1 and 65535".into());
    }
    Ok(())
}

fn bind_error(e: &std::io::Error, host: &str, port: u16) -> String {
    match e.kind() {
        std::io::ErrorKind::AddrInUse => format!(
            "port {port} is already in use (by another program, or another copy of this app); pick a different port"
        ),
        std::io::ErrorKind::AddrNotAvailable => {
            format!("{host} is not an address of this computer")
        }
        std::io::ErrorKind::PermissionDenied => {
            format!("not allowed to listen on port {port}; try a port above 1024")
        }
        _ => format!("could not listen on {host}:{port}: {e}"),
    }
}

struct Inner {
    status: McpStatus,
    running: Option<server::Served>,
}

/// The MCP server, which can be stopped and started again with another host and port.
pub struct Mcp {
    bridge: Arc<dyn Bridge>,
    /// Whether an agent has called `read_instructions` since the app started.
    read: Arc<AtomicBool>,
    inner: Mutex<Inner>,
}

impl Mcp {
    pub fn new(bridge: Arc<dyn Bridge>) -> Self {
        let status = McpStatus {
            running: false,
            host: DEFAULT_HOST.into(),
            port: DEFAULT_PORT,
            url: None,
            error: None,
            loopback: true,
        };
        Self {
            bridge,
            read: Arc::new(AtomicBool::new(false)),
            inner: Mutex::new(Inner {
                status,
                running: None,
            }),
        }
    }

    pub async fn status(&self) -> McpStatus {
        self.inner.lock().await.status.clone()
    }

    /// Stops the server if it runs, then listens on `host:port`. Never fails: a problem is
    /// reported in the returned status, so the window can show it.
    pub async fn apply(&self, host: &str, port: u16) -> McpStatus {
        let host = host.trim().to_string();
        let mut g = self.inner.lock().await;
        if let Some(mut old) = g.running.take() {
            old.stop.cancel();
            if tokio::time::timeout(Duration::from_secs(3), &mut old.task)
                .await
                .is_err()
            {
                old.task.abort();
            }
        }
        let loopback = is_loopback(&host);
        let mut status = McpStatus {
            running: false,
            host: host.clone(),
            port,
            url: None,
            error: None,
            loopback,
        };
        match check(&host, port) {
            Err(e) => status.error = Some(e),
            Ok(()) => match server::serve(
                self.bridge.clone(),
                &host,
                port,
                loopback,
                self.read.clone(),
            )
            .await
            {
                Ok(served) => {
                    let shown = if served.addr.is_ipv6() {
                        format!("[{}]", served.addr.ip())
                    } else {
                        served.addr.ip().to_string()
                    };
                    status.url = Some(format!("http://{shown}:{}/mcp", served.addr.port()));
                    status.running = true;
                    g.running = Some(served);
                }
                Err(e) => status.error = Some(bind_error(&e, &host, port)),
            },
        }
        g.status = status.clone();
        status
    }
}

#[tauri::command]
pub async fn mcp_status(mcp: State<'_, Arc<Mcp>>) -> Result<McpStatus, String> {
    Ok(mcp.status().await)
}

/// Applies a new host and port. The preferences window saves them, this restarts the server.
#[tauri::command]
pub async fn mcp_configure(
    host: String,
    port: u16,
    mcp: State<'_, Arc<Mcp>>,
) -> Result<McpStatus, String> {
    Ok(mcp.apply(&host, port).await)
}

/// Starts the MCP server on the host and port saved in the preferences (or the defaults).
pub fn start(app: &tauri::AppHandle) {
    let pending = Arc::new(bridge::Pending::default());
    app.manage(pending.clone());
    let mcp = Arc::new(Mcp::new(Arc::new(bridge::TauriBridge::new(
        app.clone(),
        pending,
    ))));
    app.manage(mcp.clone());

    let store = app.store("settings.json").ok();
    let saved = |key: &str| store.as_ref().and_then(|s| s.get(key));
    let host = saved("mcpHost")
        .and_then(|v| v.as_str().map(str::to_owned))
        .filter(|h| !h.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_HOST.into());
    let port = saved("mcpPort")
        .and_then(|v| v.as_u64())
        .and_then(|p| u16::try_from(p).ok())
        .filter(|p| *p != 0)
        .unwrap_or(DEFAULT_PORT);

    // started before the window exists, so it already has a status when preferences opens
    let status = tauri::async_runtime::block_on(mcp.apply(&host, port));
    match (&status.url, &status.error) {
        (Some(url), _) => eprintln!("MCP server: {url}"),
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
        Mcp::new(Mock::new(|_, _| Ok(json!({}))))
    }

    /// A port nobody listens on right now.
    fn free_port() -> u16 {
        std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port()
    }

    async fn reachable(port: u16) -> bool {
        tokio::net::TcpStream::connect(("127.0.0.1", port))
            .await
            .is_ok()
    }

    #[test]
    fn the_default_port_is_fixed() {
        assert_eq!(DEFAULT_PORT, 45555);
    }

    #[test]
    fn loopback_hosts() {
        for h in ["127.0.0.1", "localhost", "LOCALHOST", "::1", "127.0.0.5"] {
            assert!(is_loopback(h), "{h}");
        }
        for h in ["0.0.0.0", "192.168.1.5", "example.com", "::"] {
            assert!(!is_loopback(h), "{h}");
        }
    }

    #[test]
    fn bad_hosts_and_ports_are_explained() {
        assert!(check("127.0.0.1", 45555).is_ok());
        assert!(check("localhost", 1).is_ok());
        assert!(check("::1", 80).is_ok());
        for bad in ["", "a b", "http://x", "x/y", "ex;ample"] {
            assert!(check(bad, 45555).is_err(), "{bad:?}");
        }
        assert!(check("127.0.0.1", 0).unwrap_err().contains("1 and 65535"));
    }

    #[tokio::test]
    async fn serves_exactly_the_port_asked_for() {
        let m = mcp();
        let port = free_port();
        let s = m.apply("127.0.0.1", port).await;
        assert!(s.running && s.loopback && s.error.is_none(), "{s:?}");
        assert_eq!(s.url, Some(format!("http://127.0.0.1:{port}/mcp")));
        assert!(reachable(port).await);
        assert_eq!(m.status().await, s);
    }

    #[tokio::test]
    async fn changing_the_port_moves_the_server() {
        let m = mcp();
        let (a, b) = (free_port(), free_port());
        m.apply("127.0.0.1", a).await;
        assert!(reachable(a).await);
        let s = m.apply("127.0.0.1", b).await;
        assert!(s.running, "{s:?}");
        assert!(reachable(b).await);
        assert!(!reachable(a).await, "the old port must be released");
        // and back again on the same port
        assert!(m.apply("127.0.0.1", a).await.running);
    }

    #[tokio::test]
    async fn a_busy_port_is_reported_not_replaced() {
        let m = mcp();
        let taken = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = taken.local_addr().unwrap().port();
        let s = m.apply("127.0.0.1", port).await;
        assert!(!s.running && s.url.is_none(), "{s:?}");
        assert!(
            s.error.as_deref().unwrap().contains("already in use"),
            "{s:?}"
        );
        assert_eq!(s.port, port, "it must not quietly pick another port");
        // the failed apply leaves nothing listening on a different port either
        drop(taken);
        assert!(
            m.apply("127.0.0.1", port).await.running,
            "works once the port is free"
        );
    }

    #[tokio::test]
    async fn bad_input_stops_the_server_and_says_why() {
        let m = mcp();
        let port = free_port();
        m.apply("127.0.0.1", port).await;
        let s = m.apply("not a host", port).await;
        assert!(!s.running && s.error.is_some());
        assert!(
            !reachable(port).await,
            "an invalid configuration must not leave the old server up"
        );
        assert!(!m.apply("127.0.0.1", 0).await.running);
    }

    #[tokio::test]
    async fn non_loopback_hosts_are_flagged() {
        let m = mcp();
        let s = m.apply("0.0.0.0", free_port()).await;
        assert!(s.running && !s.loopback, "{s:?}");
        let s = m.apply("127.0.0.1", free_port()).await;
        assert!(s.loopback);
    }
}
