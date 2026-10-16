//! The MCP surface: two tools. `read_instructions` returns the manual of `fc`, a command line
//! that lives inside the app, and `exec_fc` runs it. Everything the app can do is a command, so
//! the agent's tool list stays tiny whatever the app learns to do.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, ContentBlock, ServerCapabilities, ServerConfig};
use rmcp::{ErrorData, ServerHandler, schemars, tool, tool_handler, tool_router};
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

/// What `exec_fc` says until the instructions have been read.
const READ_FIRST: &str = "You have not read the instructions yet. Call read_instructions now and read the whole result: it holds the user's own instructions and the reference of every fc command. Then run this command again; nothing was done.";

type ToolResult = Result<CallToolResult, ErrorData>;

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct ExecArgs {
    /// The command line, without the leading `fc`. Several commands can be joined with && or put on separate lines.
    args: String,
}

#[derive(Clone)]
pub struct AppTools {
    cli: Cli,
    /// Set once `read_instructions` has been called. It is shared by all connections: a client that
    /// speaks the stateless protocol gets a fresh handler per request, so the server cannot tell
    /// its sessions apart. The first agent after the app starts is held to the rule; the wording
    /// of the tools and of the server instructions has to do the rest.
    read: Arc<AtomicBool>,
    tool_router: ToolRouter<Self>,
}

impl AppTools {
    pub fn new(bridge: Arc<dyn Bridge>, read: Arc<AtomicBool>) -> Self {
        Self {
            cli: Cli::new(bridge),
            read,
            tool_router: Self::tool_router(),
        }
    }
}

#[tool_router]
impl AppTools {
    #[tool(
        description = "REQUIRED FIRST STEP, before anything else. Returns the user's own instructions and the complete reference of `fc`, the command line through which you read and edit the model and use every feature of this app. Read all of it. exec_fc refuses to run until you have."
    )]
    async fn read_instructions(&self) -> ToolResult {
        let text = self.cli.instructions().await;
        self.read.store(true, Ordering::Relaxed);
        Ok(CallToolResult::success(vec![ContentBlock::text(text)]))
    }

    #[tool(
        description = "Run fc commands, e.g. `status` or `src cat 1:40`. Only after you have read read_instructions. Give the command line without the leading `fc`; join several with && or newlines; multi-line text goes in a here-document (<<EOF). Returns text, and a picture for `shot`."
    )]
    async fn exec_fc(&self, Parameters(a): Parameters<ExecArgs>) -> ToolResult {
        if !self.read.load(Ordering::Relaxed) {
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
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions(INSTRUCTIONS)
    }
}
