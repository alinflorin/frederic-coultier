//! The MCP surface of the chat panel's agent: one tool, `exec_fc`, which runs `fc`, a command line
//! that lives inside the app. Everything the app can do is a command, so the agent's tool list
//! stays tiny whatever the app learns to do. The agent is given the manual up front, in its
//! instructions.

use std::sync::{Arc, Mutex};
use std::time::Instant;

use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{
    CallToolResult, ContentBlock, InitializeRequestParams, InitializeResult, ServerCapabilities,
    ServerConfig,
};
use rmcp::service::RequestContext;
use rmcp::{ErrorData, RoleServer, ServerHandler, schemars, tool, tool_handler, tool_router};
use serde::Deserialize;

use super::bridge::Bridge;
use super::cli::Cli;
use crate::rhino::Rhino;

/// Shown to the agent when it connects; its context already holds the manual.
const INSTRUCTIONS: &str = "\
A desktop app for designing jewellery in Rhino. The user has a project open, and Rhino is running next to the app: through the `fc` command line (the `exec_fc` tool) you \
write the design script that Rhino runs, use the Rhino plugin's tools (objects, layers, views, materials), look at the result, check it for printing, \
manage supports and the casting sprue, and export it. The complete manual is in your instructions; follow it. The app chimes by itself when a long reply ends; \
run `chime` only to get the user's attention earlier, for instance when you need an answer.";

const EXEC: &str = "Run fc commands, e.g. `status` or `src cat 1:40`, as described in your instructions. Give the command line without the leading `fc`; join several with && or newlines; multi-line text goes in a here-document (<<EOF). Returns text, and a picture for `shot` (`shot --rhino` is Rhino's own view).";

/// What agents have done since the app started, shared by all connections.
#[derive(Default)]
pub struct Gate {
    seen: Mutex<Seen>,
}

#[derive(Default)]
struct Seen {
    client: Option<String>,
    last: Option<Instant>,
    calls: u64,
}

/// A copy of what the gate has seen, for the status shown in the window.
pub struct Activity {
    pub client: Option<String>,
    /// Seconds since the last tool call or connection.
    pub idle_secs: Option<u64>,
    pub calls: u64,
}

impl Gate {
    fn seen(&self) -> std::sync::MutexGuard<'_, Seen> {
        self.seen.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn connected(&self, client: &str) {
        let mut s = self.seen();
        s.client = Some(client.to_string());
        s.last = Some(Instant::now());
    }

    fn called(&self) {
        let mut s = self.seen();
        s.last = Some(Instant::now());
        s.calls += 1;
    }

    pub fn activity(&self) -> Activity {
        let s = self.seen();
        Activity {
            client: s.client.clone(),
            idle_secs: s.last.map(|t| t.elapsed().as_secs()),
            calls: s.calls,
        }
    }
}

type ToolResult = Result<CallToolResult, ErrorData>;

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct ExecArgs {
    /// The command line, without the leading `fc`. Several commands can be joined with && or put on separate lines.
    args: String,
}

#[derive(Clone)]
pub struct AppTools {
    cli: Cli,
    gate: Arc<Gate>,
    tool_router: ToolRouter<Self>,
}

impl AppTools {
    pub fn new(bridge: Arc<dyn Bridge>, rhino: Arc<Rhino>, gate: Arc<Gate>) -> Self {
        Self {
            cli: Cli::new(bridge, rhino),
            gate,
            tool_router: Self::tool_router(),
        }
    }
}

#[tool_router]
impl AppTools {
    #[tool(
        description = EXEC
    )]
    async fn exec_fc(&self, Parameters(a): Parameters<ExecArgs>) -> ToolResult {
        self.gate.called();
        let run = self.cli.run(&a.args).await;
        let mut content = Vec::new();
        if !run.out.text.is_empty() || run.out.images.is_empty() {
            let text = if run.out.text.is_empty() {
                "(no output)".to_string()
            } else {
                run.out.text
            };
            content.push(ContentBlock::text(text));
        }
        for (data, mime) in run.out.images {
            content.push(ContentBlock::image(data, mime));
        }
        Ok(match run.error {
            None => CallToolResult::success(content),
            Some(_) => CallToolResult::error(content),
        })
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for AppTools {
    async fn initialize(
        &self,
        request: InitializeRequestParams,
        context: RequestContext<RoleServer>,
    ) -> Result<InitializeResult, ErrorData> {
        let info = &request.client_info;
        self.gate
            .connected(info.title.as_deref().unwrap_or(&info.name));
        context.peer.set_peer_info(request.clone());
        self.negotiate_initialize(&request)
    }

    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build()).with_instructions(
            INSTRUCTIONS,
        )
    }
}
