//! The MCP surface: two tools. `read_instructions` returns the manual of `fc`, a command line
//! that lives inside the app, and `exec_fc` runs it. Everything the app can do is a command, so
//! the agent's tool list stays tiny whatever the app learns to do.

use std::sync::atomic::{AtomicBool, Ordering};
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

/// Shown to the agent when it connects, before anything else. The rule at the end is the one that matters.
const INSTRUCTIONS: &str = "\
A desktop CAD app for jewellery. The user has a project open: through the `fc` command line you read and edit its \
OpenSCAD model, look at it, check it for printing, manage supports and the casting sprue, and export it.

IMPORTANT, BEFORE ANYTHING ELSE: call `read_instructions` and read the whole result. It holds the user's own \
instructions and the full reference of `fc`. Do this before your first `exec_fc` call, even for a simple question; \
`exec_fc` refuses to run until you have.";

/// For the agent of the chat panel, whose context already holds the manual (there is no `read_instructions` for it).
const EMBEDDED_INSTRUCTIONS: &str = "\
A desktop CAD app for jewellery. The user has a project open: through the `fc` command line (the `exec_fc` tool) you \
read and edit its OpenSCAD model, look at it, check it for printing, manage supports and the casting sprue, and \
export it. The complete manual is in your instructions; follow it.";

const EMBEDDED_EXEC: &str = "Run fc commands, e.g. `status` or `src cat 1:40`, as described in your instructions. Give the command line without the leading `fc`; join several with && or newlines; multi-line text goes in a here-document (<<EOF). Returns text, and a picture for `shot`.";

/// What `exec_fc` says until the instructions have been read.
const READ_FIRST: &str = "You have not read the instructions yet. Call read_instructions now and read the whole result: it holds the user's own instructions and the reference of every fc command. Then run this command again; nothing was done.";

/// What agents have done since the app started. It is shared by all connections: a client that
/// speaks the stateless protocol gets a fresh handler per request, so the server cannot tell its
/// sessions apart. The first agent after the app starts is held to the read-first rule; the
/// wording of the tools and of the server instructions has to do the rest.
#[derive(Default)]
pub struct Gate {
    /// Set once `read_instructions` has been called.
    read: AtomicBool,
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
    /// Serves the chat panel's own agent, which was given the manual up front.
    embedded: bool,
    tool_router: ToolRouter<Self>,
}

impl AppTools {
    pub fn new(bridge: Arc<dyn Bridge>, gate: Arc<Gate>) -> Self {
        Self {
            cli: Cli::new(bridge),
            gate,
            embedded: false,
            tool_router: Self::tool_router(),
        }
    }

    /// The tools for the chat panel's agent: no `read_instructions`, and no need to have read it.
    pub fn embedded(bridge: Arc<dyn Bridge>, gate: Arc<Gate>) -> Self {
        let mut tools = Self::new(bridge, gate);
        tools.embedded = true;
        tools.tool_router.remove_route("read_instructions");
        if let Some(route) = tools.tool_router.map.get_mut("exec_fc") {
            route.attr.description = Some(EMBEDDED_EXEC.into());
        }
        tools
    }
}

#[tool_router]
impl AppTools {
    #[tool(
        description = "REQUIRED FIRST STEP, before anything else. Returns the user's own instructions and the complete reference of `fc`, the command line through which you read and edit the model and use every feature of this app. Read all of it. exec_fc refuses to run until you have."
    )]
    async fn read_instructions(&self) -> ToolResult {
        let text = self.cli.instructions().await;
        self.gate.called();
        self.gate.read.store(true, Ordering::Relaxed);
        Ok(CallToolResult::success(vec![ContentBlock::text(text)]))
    }

    #[tool(
        description = "Run fc commands, e.g. `status` or `src cat 1:40`. Only after you have read read_instructions. Give the command line without the leading `fc`; join several with && or newlines; multi-line text goes in a here-document (<<EOF). Returns text, and a picture for `shot`."
    )]
    async fn exec_fc(&self, Parameters(a): Parameters<ExecArgs>) -> ToolResult {
        self.gate.called();
        if !self.embedded && !self.gate.read.load(Ordering::Relaxed) {
            return Ok(CallToolResult::error(vec![ContentBlock::text(READ_FIRST)]));
        }
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
            if self.embedded {
                EMBEDDED_INSTRUCTIONS
            } else {
                INSTRUCTIONS
            },
        )
    }
}
