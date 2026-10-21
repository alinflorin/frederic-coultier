//! The local HTTP endpoint the chat panel's agents connect to: MCP over streamable HTTP, on loopback only.

use std::net::SocketAddr;
use std::sync::Arc;

use tokio_util::sync::CancellationToken;

use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};

use super::bridge::Bridge;
use crate::rhino::Rhino;
use super::tools::{AppTools, Gate};

/// Where the endpoint is served.
pub const PATH: &str = "/chat";

/// `loopback`: the server only accepts local `Host` names. Binding to another address turns that
/// check off (clients then reach it by whatever name or address they like).
pub fn router(
    bridge: Arc<dyn Bridge>,
    rhino: Arc<Rhino>,
    loopback: bool,
    gate: Arc<Gate>,
    stop: &CancellationToken,
) -> axum::Router {
    // No request may carry an Origin header: browsers always send one, so a web page can't drive
    // the app; the agents don't. Cancelling `stop` ends open sessions.
    let mut config = StreamableHttpServerConfig::default()
        .enforce_origin_validation()
        .with_cancellation_token(stop.child_token());
    if !loopback {
        config = config.disable_allowed_hosts();
    }
    let service: StreamableHttpService<AppTools, LocalSessionManager> = StreamableHttpService::new(
        move || Ok(AppTools::new(bridge.clone(), rhino.clone(), gate.clone())),
        Default::default(),
        config,
    );
    axum::Router::new().nest_service(PATH, service)
}

/// A server that is up: where it listens, and how to stop it.
pub struct Served {
    pub addr: SocketAddr,
    pub stop: CancellationToken,
    pub task: tauri::async_runtime::JoinHandle<()>,
}

/// Binds exactly `host:port` (no fallback to another port) and serves in the background.
pub async fn serve(
    bridge: Arc<dyn Bridge>,
    rhino: Arc<Rhino>,
    host: &str,
    port: u16,
    loopback: bool,
    gate: Arc<Gate>,
) -> std::io::Result<Served> {
    let listener = tokio::net::TcpListener::bind((host, port)).await?;
    let addr = listener.local_addr()?;
    let stop = CancellationToken::new();
    let app = router(bridge, rhino, loopback, gate, &stop);
    let signal = stop.clone();
    let task = tauri::async_runtime::spawn(async move {
        if let Err(e) = axum::serve(listener, app)
            .with_graceful_shutdown(async move { signal.cancelled_owned().await })
            .await
        {
            eprintln!("MCP server stopped: {e}");
        }
    });
    Ok(Served { addr, stop, task })
}

#[cfg(test)]
mod tests {
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use serde_json::{Value, json};
    use tower::ServiceExt;

    use super::*;
    use crate::agent::bridge::mock::Mock;

    /// Sends one JSON-RPC message the way an MCP client does and returns (session id, JSON body).
    async fn rpc(
        app: &axum::Router,
        session: Option<&str>,
        origin: Option<&str>,
        body: Value,
    ) -> (StatusCode, Option<String>, Value) {
        rpc_at(PATH, app, session, origin, body).await
    }

    async fn rpc_at(
        uri: &str,
        app: &axum::Router,
        session: Option<&str>,
        origin: Option<&str>,
        body: Value,
    ) -> (StatusCode, Option<String>, Value) {
        let mut req = Request::builder()
            .method("POST")
            .uri(uri)
            .header("host", "127.0.0.1")
            .header("content-type", "application/json")
            .header("accept", "application/json, text/event-stream");
        if let Some(sid) = session {
            req = req.header("mcp-session-id", sid);
        }
        if let Some(o) = origin {
            req = req.header("origin", o);
        }
        let res = app
            .clone()
            .oneshot(req.body(Body::from(body.to_string())).unwrap())
            .await
            .unwrap();
        let status = res.status();
        let sid = res
            .headers()
            .get("mcp-session-id")
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);
        let bytes = axum::body::to_bytes(res.into_body(), 1 << 22)
            .await
            .unwrap();
        let text = String::from_utf8_lossy(&bytes);
        // either plain JSON or an event stream whose "data:" line holds the message
        let json = text
            .lines()
            .filter_map(|l| l.strip_prefix("data:"))
            .map(str::trim)
            .find(|d| d.starts_with('{'))
            .map(str::to_owned)
            .unwrap_or_else(|| text.to_string());
        (
            status,
            sid,
            serde_json::from_str(&json).unwrap_or(Value::Null),
        )
    }

    fn test_rhino() -> Arc<crate::rhino::Rhino> {
        Arc::new(crate::rhino::Rhino::new("127.0.0.1", 1, std::env::temp_dir()))
    }

    fn test_router(bridge: Arc<Mock>) -> axum::Router {
        router(
            bridge,
            test_rhino(),
            true,
            Arc::new(Gate::default()),
            &CancellationToken::new(),
        )
    }

    fn init() -> Value {
        json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": { "name": "test", "version": "0" } } })
    }

    fn call(id: u64, name: &str, args: Value) -> Value {
        json!({ "jsonrpc": "2.0", "id": id, "method": "tools/call", "params": { "name": name, "arguments": args } })
    }

    async fn session(app: &axum::Router) -> (String, Value) {
        let (_, sid, init) = rpc(app, None, None, init()).await;
        let sid = sid.expect("a session id");
        rpc(
            app,
            Some(&sid),
            None,
            json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
        )
        .await;
        (sid, init)
    }

    #[tokio::test]
    async fn the_agent_sees_one_tool_and_can_run_commands() {
        let bridge = Mock::new(|op, _| match op {
            "source.get" => Ok(json!({ "source": "rs.AddBox([0,0,0])\n", "rev": 1 })),
            "view.capture" => Ok(
                json!({ "png": "iVBORw0KGgo=", "width": 64, "height": 48, "note": "Scene: as modelled." }),
            ),
            other => Err(format!("unexpected {other}")),
        });
        let app = test_router(bridge.clone());
        let (sid, init) = session(&app).await;
        assert!(init["result"]["capabilities"]["tools"].is_object(), "{init}");
        let told = init["result"]["instructions"].as_str().unwrap_or_default();
        assert!(told.contains("jewellery") && !told.contains("read_instructions"), "{told}");

        let (_, _, list) = rpc(
            &app,
            Some(&sid),
            None,
            json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }),
        )
        .await;
        let tools = list["result"]["tools"].as_array().expect("tools");
        let names: Vec<&str> = tools.iter().filter_map(|t| t["name"].as_str()).collect();
        assert_eq!(names, ["exec_fc"]);
        assert_eq!(tools[0]["inputSchema"]["required"], json!(["args"]));
        assert!(!tools[0]["description"].as_str().unwrap().contains("read_instructions"));
        // the whole tool list is small: that is the point
        assert!(list.to_string().len() < 2000, "tool list is {} bytes", list.to_string().len());

        // runs straight away, nothing has to be read first
        let (_, _, read) = rpc(&app, Some(&sid), None, call(4, "exec_fc", json!({ "args": "src cat" }))).await;
        assert_eq!(read["result"]["isError"], false, "{read}");
        assert!(read["result"]["content"][0]["text"].as_str().unwrap().contains("1\trs.AddBox"), "{read}");

        let (_, _, shot) = rpc(
            &app,
            Some(&sid),
            None,
            call(5, "exec_fc", json!({ "args": "shot --view top --zoom 2" })),
        )
        .await;
        let content = shot["result"]["content"].as_array().unwrap();
        assert_eq!(content[1]["type"], "image", "{shot}");
        assert_eq!(content[1]["mimeType"], "image/png");
        let sent = bridge.calls.lock().unwrap().iter().find(|c| c.0 == "view.capture").unwrap().1.clone();
        assert_eq!(sent, json!({ "view": "top", "zoom": 2.0 }));

        let (_, _, bad) = rpc(&app, Some(&sid), None, call(6, "exec_fc", json!({ "args": "nonsense" }))).await;
        assert_eq!(bad["result"]["isError"], true, "{bad}");
        assert!(bad["result"]["content"][0]["text"].as_str().unwrap().contains("unknown command"));

        let (_, _, help) = rpc(&app, Some(&sid), None, call(7, "exec_fc", json!({ "args": "help" }))).await;
        assert!(help["result"]["content"][0]["text"].as_str().unwrap().contains("fc commands"), "{help}");
    }

    #[tokio::test]
    async fn the_gate_records_who_connected_and_what_they_called() {
        let gate = Arc::new(Gate::default());
        let app = router(
            Mock::new(|_, _| Ok(json!({}))),
            test_rhino(),
            true,
            gate.clone(),
            &CancellationToken::new(),
        );
        let before = gate.activity();
        assert!(before.client.is_none() && before.idle_secs.is_none() && before.calls == 0);
        let (sid, _) = session(&app).await;
        let mid = gate.activity();
        assert_eq!(mid.client.as_deref(), Some("test"));
        assert_eq!(mid.calls, 0, "connecting is not a call");
        rpc(&app, Some(&sid), None, call(3, "exec_fc", json!({ "args": "help" }))).await;
        let after = gate.activity();
        assert_eq!(after.calls, 1);
        assert!(after.idle_secs.unwrap() < 5);
    }

    #[tokio::test]
    async fn requests_from_a_web_page_are_refused() {
        let app = test_router(Mock::new(|_, _| Ok(json!({}))));
        let (status, _, _) = rpc(&app, None, Some("https://evil.example"), init()).await;
        assert_eq!(status, StatusCode::FORBIDDEN);
        let (status, _, _) = rpc(&app, None, Some("http://localhost:3000"), init()).await;
        assert_eq!(
            status,
            StatusCode::FORBIDDEN,
            "even localhost pages: they are web pages too"
        );
        let (status, _, _) = rpc(&app, None, None, init()).await;
        assert!(status.is_success());
    }

    #[tokio::test]
    async fn other_host_names_are_refused() {
        let app = test_router(Mock::new(|_, _| Ok(json!({}))));
        let req = Request::builder()
            .method("POST")
            .uri(PATH)
            .header("host", "attacker.example")
            .header("content-type", "application/json")
            .header("accept", "application/json, text/event-stream")
            .body(Body::from(init().to_string()))
            .unwrap();
        let res = app.oneshot(req).await.unwrap();
        assert!(
            !res.status().is_success(),
            "DNS rebinding must not work: {}",
            res.status()
        );
    }

    #[tokio::test]
    async fn the_old_public_door_is_gone() {
        let app = test_router(Mock::new(|_, _| Ok(json!({}))));
        let (status, _, _) = rpc_at("/mcp", &app, None, None, init()).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
    }
}
