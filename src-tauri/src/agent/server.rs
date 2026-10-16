//! The local HTTP endpoint agents connect to: MCP over streamable HTTP.

use std::net::SocketAddr;
use std::sync::Arc;

use tokio_util::sync::CancellationToken;

use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};

use super::bridge::Bridge;
use super::tools::{AppTools, Gate};

/// `loopback`: the server only accepts local `Host` names. Binding to another address turns that
/// check off (clients then reach it by whatever name or address they like).
pub fn router(
    bridge: Arc<dyn Bridge>,
    loopback: bool,
    gate: Arc<Gate>,
    stop: &CancellationToken,
) -> axum::Router {
    // No request may carry an Origin header: browsers always send one, so a web page can't drive
    // the app; MCP clients and the inspector's proxy don't. Cancelling `stop` ends open sessions.
    let mut config = StreamableHttpServerConfig::default()
        .enforce_origin_validation()
        .with_cancellation_token(stop.child_token());
    if !loopback {
        config = config.disable_allowed_hosts();
    }
    let service: StreamableHttpService<AppTools, LocalSessionManager> = StreamableHttpService::new(
        move || Ok(AppTools::new(bridge.clone(), gate.clone())),
        Default::default(),
        config,
    );
    axum::Router::new().nest_service("/mcp", service)
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
    host: &str,
    port: u16,
    loopback: bool,
    gate: Arc<Gate>,
) -> std::io::Result<Served> {
    let listener = tokio::net::TcpListener::bind((host, port)).await?;
    let addr = listener.local_addr()?;
    let stop = CancellationToken::new();
    let app = router(bridge, loopback, gate, &stop);
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
        let mut req = Request::builder()
            .method("POST")
            .uri("/mcp")
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

    fn test_router(bridge: Arc<Mock>) -> axum::Router {
        router(
            bridge,
            true,
            Arc::new(Gate::default()),
            &CancellationToken::new(),
        )
    }

    fn init() -> Value {
        json!({ "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": { "name": "test", "version": "0" } } })
    }

    #[tokio::test]
    async fn an_mcp_client_sees_two_tools_and_can_run_commands() {
        let bridge = Mock::new(|op, _| match op {
            "source.get" => Ok(json!({ "source": "cube(2);
", "rev": 1 })),
            "view.capture" => Ok(
                json!({ "png": "iVBORw0KGgo=", "width": 64, "height": 48, "note": "Scene: as modelled." }),
            ),
            other => Err(format!("unexpected {other}")),
        });
        let app = test_router(bridge.clone());

        let (_, sid, init) = rpc(&app, None, None, init()).await;
        assert!(
            init["result"]["capabilities"]["tools"].is_object(),
            "{init}"
        );
        let sid = sid.expect("a session id");
        rpc(
            &app,
            Some(&sid),
            None,
            json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }),
        )
        .await;

        let (_, _, list) = rpc(
            &app,
            Some(&sid),
            None,
            json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }),
        )
        .await;
        let tools = list["result"]["tools"].as_array().expect("tools");
        let mut names: Vec<&str> = tools.iter().filter_map(|t| t["name"].as_str()).collect();
        names.sort();
        assert_eq!(names, ["exec_fc", "read_instructions"]);
        let exec = tools.iter().find(|t| t["name"] == "exec_fc").unwrap();
        assert_eq!(exec["inputSchema"]["required"], json!(["args"]));
        // the whole tool list is small: that is the point
        assert!(
            list.to_string().len() < 2000,
            "tool list is {} bytes",
            list.to_string().len()
        );

        let call = |id: u64, name: &str, args: Value| json!({ "jsonrpc": "2.0", "id": id, "method": "tools/call", "params": { "name": name, "arguments": args } });

        let (_, _, manual) = rpc(
            &app,
            Some(&sid),
            None,
            call(3, "read_instructions", json!({})),
        )
        .await;
        let text = manual["result"]["content"][0]["text"].as_str().unwrap();
        assert!(
            text.contains("# fc reference") && text.contains("### `src edit`"),
            "{manual}"
        );

        let (_, _, read) = rpc(
            &app,
            Some(&sid),
            None,
            call(4, "exec_fc", json!({ "args": "src cat" })),
        )
        .await;
        assert!(
            read["result"]["content"][0]["text"]
                .as_str()
                .unwrap()
                .contains("1	cube(2);"),
            "{read}"
        );

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
        let sent = bridge
            .calls
            .lock()
            .unwrap()
            .iter()
            .find(|c| c.0 == "view.capture")
            .unwrap()
            .1
            .clone();
        assert_eq!(sent, json!({ "view": "top", "zoom": 2.0 }));

        let (_, _, bad) = rpc(
            &app,
            Some(&sid),
            None,
            call(6, "exec_fc", json!({ "args": "nonsense" })),
        )
        .await;
        assert_eq!(bad["result"]["isError"], true, "{bad}");
        assert!(
            bad["result"]["content"][0]["text"]
                .as_str()
                .unwrap()
                .contains("unknown command")
        );
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
    async fn the_server_tells_agents_to_read_the_instructions_first() {
        let app = test_router(Mock::new(|_, _| Ok(json!({}))));
        let (sid, init) = session(&app).await;
        let text = init["result"]["instructions"]
            .as_str()
            .expect("server instructions");
        assert!(
            text.contains("jewellery")
                && text.contains("BEFORE ANYTHING ELSE")
                && text.contains("read_instructions"),
            "{text}"
        );
        let (_, _, list) = rpc(
            &app,
            Some(&sid),
            None,
            json!({ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }),
        )
        .await;
        let desc = |name: &str| {
            list["result"]["tools"]
                .as_array()
                .unwrap()
                .iter()
                .find(|t| t["name"] == name)
                .unwrap()["description"]
                .as_str()
                .unwrap()
                .to_string()
        };
        assert!(desc("read_instructions").contains("REQUIRED FIRST STEP"));
        assert!(desc("exec_fc").contains("Only after you have read read_instructions"));
    }

    #[tokio::test]
    async fn the_gate_records_who_connected_and_what_they_called() {
        let gate = Arc::new(Gate::default());
        let app = router(
            Mock::new(|_, _| Ok(json!({}))),
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
        rpc(
            &app,
            Some(&sid),
            None,
            json!({ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "read_instructions", "arguments": {} } }),
        )
        .await;
        let after = gate.activity();
        assert_eq!(after.calls, 1);
        assert!(after.idle_secs.unwrap() < 5);
    }

    #[tokio::test]
    async fn exec_refuses_to_run_until_the_instructions_were_read() {
        let bridge = Mock::new(|op, _| match op {
            "source.get" => Ok(json!({ "source": "cube(1);\n", "rev": 1 })),
            _ => Err("unexpected".into()),
        });
        let app = test_router(bridge.clone());
        let (sid, _) = session(&app).await;

        let (_, _, early) = rpc(
            &app,
            Some(&sid),
            None,
            call(3, "exec_fc", json!({ "args": "src cat" })),
        )
        .await;
        assert_eq!(early["result"]["isError"], true, "{early}");
        assert!(
            early["result"]["content"][0]["text"]
                .as_str()
                .unwrap()
                .contains("Call read_instructions"),
            "{early}"
        );
        assert!(
            bridge
                .calls
                .lock()
                .unwrap()
                .iter()
                .all(|c| c.0 == "settings.schema"),
            "nothing may run before the instructions were read: {:?}",
            bridge.calls.lock().unwrap()
        );

        let (_, _, read) = rpc(
            &app,
            Some(&sid),
            None,
            call(4, "read_instructions", json!({})),
        )
        .await;
        assert_eq!(read["result"]["isError"], false, "{read}");
        let (_, _, ok) = rpc(
            &app,
            Some(&sid),
            None,
            call(5, "exec_fc", json!({ "args": "src cat" })),
        )
        .await;
        assert_eq!(ok["result"]["isError"], false, "{ok}");
        assert!(
            ok["result"]["content"][0]["text"]
                .as_str()
                .unwrap()
                .contains("cube(1);")
        );
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
            .uri("/mcp")
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
}
