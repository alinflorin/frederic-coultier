//! The chat panel's agent: Claude Code or Codex, run as a child process on the user's own
//! sign-in, with this app's MCP server as its only tool source.
//!
//! Both vendors' SDKs do exactly this underneath (start their CLI and read its JSON lines), so
//! the app does it directly and needs no Node.js. An [`Engine`] knows how to start one CLI and
//! how to read its output; [`run`] is the same for all of them.

pub mod claude;
pub mod codex;

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio_util::sync::CancellationToken;

use super::Mcp;

/// What an engine's output means for the panel.
#[derive(Debug, Clone, PartialEq)]
pub enum Event {
    /// The id to resume this conversation with next time.
    Session(String),
    /// More of the reply.
    Delta(String),
    /// A new paragraph of the reply starts (a gap is added if there is text already).
    Break,
    /// The agent called one of our tools.
    ToolStart(ToolCall),
    /// The tool answered (matched to its call by `id`).
    ToolEnd {
        id: String,
        output: Vec<Part>,
        error: bool,
    },
    /// Something went wrong that may or may not matter; kept in case the run ends badly.
    Warn(String),
    /// The turn ended well.
    Done,
    /// The turn ended badly.
    Failed(String),
}

/// A piece of what a tool answered.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Part {
    Text { text: String },
    Image { mime: String, data: String },
}

/// One use of a tool, for the chat to show.
#[derive(Debug, Clone, Serialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    /// What the agent asked for, as text.
    pub input: String,
    pub output: Vec<Part>,
    pub error: bool,
    pub done: bool,
}

/// Longest text kept of a tool's answer, and biggest picture (base64), so a project file stays small.
const MAX_TEXT: usize = 20_000;
const MAX_IMAGE: usize = 1_500_000;

fn trimmed(parts: Vec<Part>) -> Vec<Part> {
    parts
        .into_iter()
        .map(|p| match p {
            Part::Text { text } if text.chars().count() > MAX_TEXT => Part::Text {
                text: text.chars().take(MAX_TEXT).collect::<String>() + "\n… (cut)",
            },
            Part::Image { data, .. } if data.len() > MAX_IMAGE => Part::Text {
                text: "(picture left out: too large)".into(),
            },
            p => p,
        })
        .collect()
}

/// How a tool's arguments read in the chat: `exec_fc`'s command line as it is, anything else as JSON.
pub(crate) fn input_text(args: &serde_json::Value) -> String {
    match args.get("args").and_then(|a| a.as_str()) {
        Some(a) if args.as_object().is_some_and(|o| o.len() == 1) => a.to_string(),
        _ if args.is_null() || args.as_object().is_some_and(|o| o.is_empty()) => String::new(),
        _ => args.to_string(),
    }
}

/// Where the engines may work.
pub struct Paths {
    /// A folder of ours for scratch files and for the engines' own session storage.
    pub private: PathBuf,
    /// Where Codex keeps its sign-in (`CODEX_HOME`, or `.codex` in the user's home folder).
    pub codex_home: PathBuf,
}

/// A model the user can pick, and how hard it can be made to think.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub label: String,
    /// The thinking levels it takes, lowest first; empty if it has no such setting.
    pub efforts: Vec<String>,
}

pub struct Turn<'a> {
    /// The model to use; the CLI's own choice if `None`.
    pub model: Option<&'a str>,
    /// How hard it should think; the CLI's own choice if `None`.
    pub effort: Option<&'a str>,
    pub prompt: &'a str,
    /// Continue this conversation, if the engine knows it.
    pub session: Option<&'a str>,
    pub mcp_url: &'a str,
}

/// A process to start.
pub struct Invocation {
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    pub dir: PathBuf,
    /// Sent to the process on stdin (the prompt, which can be long and full of quotes).
    pub stdin: String,
}

pub trait Engine: Send + Sync {
    fn id(&self) -> &'static str;
    fn label(&self) -> &'static str;
    /// The command on the PATH.
    fn program(&self) -> &'static str;
    /// Arguments of a quick command that tells whether somebody is signed in.
    fn probe_args(&self) -> Vec<String>;
    /// Reads that command's result: who is signed in, or why nobody is.
    fn judge(&self, ok: bool, output: &str, paths: &Paths) -> Result<String, String>;
    /// The models offered when the engine has no list of its own to ask for.
    fn models(&self) -> Vec<ModelInfo> {
        Vec::new()
    }
    /// A command that prints the models, if the CLI can say.
    fn models_args(&self) -> Option<Vec<String>> {
        None
    }
    fn parse_models(&self, _output: &str) -> Vec<ModelInfo> {
        Vec::new()
    }
    /// The thinking levels when no model is picked.
    fn default_efforts(&self) -> Vec<String> {
        Vec::new()
    }
    fn prepare(&self, turn: &Turn, paths: &Paths) -> Result<Invocation, String>;
    /// Reads one line of output.
    fn parse(&self, line: &str) -> Vec<Event>;
    /// Called after a run, to put back anything `prepare` set aside.
    fn finish(&self, _paths: &Paths) {}
}

pub fn engines() -> Vec<Box<dyn Engine>> {
    vec![Box::new(claude::Claude), Box::new(codex::Codex)]
}

fn engine(id: &str) -> Result<Box<dyn Engine>, String> {
    engines()
        .into_iter()
        .find(|e| e.id() == id)
        .ok_or_else(|| format!("unknown agent {id:?}"))
}

fn command(program: &str) -> tokio::process::Command {
    // npm installs the CLIs as .cmd shims on Windows, which only the shell finds
    let mut c = if cfg!(windows) {
        let mut c = tokio::process::Command::new("cmd");
        c.arg("/C").arg(program);
        c
    } else {
        tokio::process::Command::new(program)
    };
    c.kill_on_drop(true);
    c
}

fn not_found(program: &str, e: &std::io::Error) -> String {
    match e.kind() {
        std::io::ErrorKind::NotFound => {
            format!("`{program}` was not found; is it installed and on the PATH?")
        }
        _ => format!("could not start `{program}`: {e}"),
    }
}

/// Whether an engine can be used right now.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EngineInfo {
    pub id: &'static str,
    pub label: &'static str,
    pub available: bool,
    /// Who is signed in, or what is missing.
    pub detail: String,
    pub models: Vec<ModelInfo>,
    /// The thinking levels of the engine's own default model.
    pub efforts: Vec<String>,
}

/// Runs a quick command and returns whether it succeeded and what it printed.
async fn capture(program: &str, args: Vec<String>) -> Result<(bool, String), String> {
    let mut c = command(program);
    c.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let child = c.spawn().map_err(|err| not_found(program, &err))?;
    let out = tokio::time::timeout(Duration::from_secs(15), child.wait_with_output())
        .await
        .map_err(|_| format!("`{program}` did not answer in 15 seconds"))?
        .map_err(|e| e.to_string())?;
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    Ok((out.status.success(), text.trim().to_string()))
}

async fn probe(e: &dyn Engine, paths: &Paths) -> EngineInfo {
    let verdict = match capture(e.program(), e.probe_args()).await {
        Err(why) => Err(why),
        Ok((ok, text)) => e.judge(ok, &text, paths),
    };
    let mut models = e.models();
    if verdict.is_ok()
        && let Some(args) = e.models_args()
        && let Ok((true, text)) = capture(e.program(), args).await
    {
        models = e.parse_models(&text);
    }
    EngineInfo {
        id: e.id(),
        label: e.label(),
        available: verdict.is_ok(),
        detail: verdict.unwrap_or_else(|why| why),
        models,
        efforts: e.default_efforts(),
    }
}

fn paths(app: &AppHandle) -> Result<Paths, String> {
    let private = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("agent-chat");
    std::fs::create_dir_all(&private)
        .map_err(|e| format!("could not create {}: {e}", private.display()))?;
    let codex_home = match std::env::var_os("CODEX_HOME") {
        Some(h) => PathBuf::from(h),
        None => app
            .path()
            .home_dir()
            .map_err(|e| e.to_string())?
            .join(".codex"),
    };
    Ok(Paths {
        private,
        codex_home,
    })
}

/// Which agents are installed and signed in on this computer.
#[tauri::command]
pub async fn chat_engines(app: AppHandle) -> Result<Vec<EngineInfo>, String> {
    let paths = Arc::new(paths(&app)?);
    let tasks: Vec<_> = engines()
        .into_iter()
        .map(|e| {
            let paths = paths.clone();
            tokio::spawn(async move { probe(e.as_ref(), &paths).await })
        })
        .collect();
    let mut out = Vec::new();
    for t in tasks {
        out.push(t.await.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// What a finished turn left behind.
#[derive(Debug, Default, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Reply {
    pub session: Option<String>,
    pub text: String,
    pub tools: Vec<ToolCall>,
    pub cancelled: bool,
}

/// Runs one turn to its end. `emit` hears everything as it happens.
pub async fn run(
    e: &dyn Engine,
    turn: &Turn<'_>,
    paths: &Paths,
    cancel: &CancellationToken,
    emit: &(dyn Fn(&Event) + Send + Sync),
) -> Result<Reply, String> {
    let inv = e.prepare(turn, paths)?;
    let result = drive(e, inv, cancel, emit).await;
    e.finish(paths);
    result
}

async fn drive(
    e: &dyn Engine,
    inv: Invocation,
    cancel: &CancellationToken,
    emit: &(dyn Fn(&Event) + Send + Sync),
) -> Result<Reply, String> {
    let mut c = command(e.program());
    c.args(&inv.args)
        .envs(inv.env.iter().map(|(k, v)| (k, v)))
        .current_dir(&inv.dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = c.spawn().map_err(|err| not_found(e.program(), &err))?;

    let mut stdin = child.stdin.take().ok_or("no stdin")?;
    let text = inv.stdin;
    tokio::spawn(async move {
        let _ = stdin.write_all(text.as_bytes()).await;
        // closing it tells the CLI the prompt is complete
    });
    let mut stderr = child.stderr.take().ok_or("no stderr")?;
    let err_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        let _ = (&mut stderr).take(64 * 1024).read_to_end(&mut buf).await;
        String::from_utf8_lossy(&buf).into_owned()
    });
    let mut lines = BufReader::new(child.stdout.take().ok_or("no stdout")?).lines();

    let mut reply = Reply::default();
    let (mut gap, mut failed, mut warn, mut done) = (false, None::<String>, None::<String>, false);
    loop {
        let line = tokio::select! {
            _ = cancel.cancelled() => {
                let _ = child.kill().await;
                reply.cancelled = true;
                return Ok(reply);
            }
            l = lines.next_line() => l.map_err(|err| err.to_string())?,
        };
        let Some(line) = line else { break };
        for ev in e.parse(&line) {
            match &ev {
                Event::Session(id) => reply.session = Some(id.clone()),
                Event::Break => gap = true,
                Event::Delta(d) => {
                    let d = if gap && !reply.text.is_empty() {
                        format!("\n\n{d}")
                    } else {
                        d.clone()
                    };
                    gap = false;
                    reply.text.push_str(&d);
                    emit(&Event::Delta(d));
                    continue;
                }
                Event::ToolStart(call) => reply.tools.push(call.clone()),
                Event::ToolEnd { id, output, error } => {
                    let Some(call) = reply.tools.iter_mut().find(|c| &c.id == id) else {
                        continue;
                    };
                    call.output = trimmed(output.clone());
                    call.error = *error;
                    call.done = true;
                    emit(&Event::ToolEnd {
                        id: id.clone(),
                        output: call.output.clone(),
                        error: *error,
                    });
                    continue;
                }
                Event::Warn(w) => warn = Some(w.clone()),
                Event::Done => done = true,
                Event::Failed(f) => failed = Some(f.clone()),
            }
            emit(&ev);
        }
    }
    let status = child.wait().await.map_err(|err| err.to_string())?;
    let stderr = err_task.await.unwrap_or_default();
    if let Some(f) = failed {
        return Err(f);
    }
    if !done {
        let why = warn
            .or_else(|| Some(stderr.trim().to_string()).filter(|s| !s.is_empty()))
            .unwrap_or_else(|| format!("`{}` stopped ({status}) without answering", e.program()));
        return Err(why);
    }
    Ok(reply)
}

/// The turn being run, if any, so it can be stopped.
#[derive(Default)]
pub struct Running(Mutex<Option<CancellationToken>>);

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum Wire<'a> {
    Delta {
        text: &'a str,
    },
    /// A tool call began.
    Tool {
        call: &'a ToolCall,
    },
    /// It ended; `call` is the whole call, as it will be kept.
    ToolDone {
        id: &'a str,
        output: &'a [Part],
        error: bool,
    },
}

/// Sends one message to the agent and waits for its whole answer. What it says is also sent as
/// `chat-event`s while it is still working.
#[tauri::command]
pub async fn chat_send(
    engine_id: String,
    prompt: String,
    session: Option<String>,
    model: Option<String>,
    effort: Option<String>,
    app: AppHandle,
    mcp: State<'_, Arc<Mcp>>,
    running: State<'_, Running>,
) -> Result<Reply, String> {
    let e = engine(&engine_id)?;
    let url = mcp
        .status()
        .await
        .url
        .ok_or("The agent connection (MCP) is not running; see Preferences.")?;
    let paths = paths(&app)?;
    let cancel = CancellationToken::new();
    {
        let mut slot = running.0.lock().unwrap();
        if slot.is_some() {
            return Err("The agent is still answering.".into());
        }
        *slot = Some(cancel.clone());
    }
    let emit = |ev: &Event| {
        let wire = match ev {
            Event::Delta(text) => Wire::Delta { text },
            Event::ToolStart(call) => Wire::Tool { call },
            Event::ToolEnd { id, output, error } => Wire::ToolDone {
                id,
                output,
                error: *error,
            },
            _ => return,
        };
        let _ = app.emit("chat-event", wire);
    };
    let turn = Turn {
        model: model.as_deref().filter(|m| !m.is_empty()),
        effort: effort.as_deref().filter(|m| !m.is_empty()),
        prompt: &prompt,
        session: session.as_deref(),
        mcp_url: &url,
    };
    let result = run(e.as_ref(), &turn, &paths, &cancel, &emit).await;
    *running.0.lock().unwrap() = None;
    result
}

/// Stops the turn in progress; `chat_send` then returns what was said so far.
#[tauri::command]
pub fn chat_cancel(running: State<'_, Running>) {
    if let Some(c) = running.0.lock().unwrap().as_ref() {
        c.cancel();
    }
}

/// Where the conversation about a project file is kept: with the app, never inside the project.
fn history_file(paths: &Paths, key: &str) -> Result<PathBuf, String> {
    // FNV-1a: the same name for the same path on every run
    let hash = key.bytes().fold(0xcbf29ce484222325u64, |h, b| {
        (h ^ b as u64).wrapping_mul(0x100000001b3)
    });
    Ok(subdir(paths, "history")?.join(format!("{hash:016x}.json")))
}

/// The saved conversation of the project at `key` (its path), if there is one.
#[tauri::command]
pub fn chat_load(key: String, app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let file = history_file(&paths(&app)?, &key)?;
    match std::fs::read(&file) {
        Ok(bytes) => Ok(serde_json::from_slice(&bytes).ok()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("could not read {}: {e}", file.display())),
    }
}

/// Keeps the conversation of the project at `key`; `None` forgets it.
#[tauri::command]
pub fn chat_save(
    key: String,
    log: Option<serde_json::Value>,
    app: AppHandle,
) -> Result<(), String> {
    let file = history_file(&paths(&app)?, &key)?;
    match log {
        None => {
            let _ = std::fs::remove_file(&file);
            Ok(())
        }
        Some(v) => std::fs::write(&file, v.to_string())
            .map_err(|e| format!("could not write {}: {e}", file.display())),
    }
}

pub fn manage(app: &AppHandle) {
    app.manage(Running::default());
}

/// A folder inside `private`, created on demand.
pub(crate) fn subdir(paths: &Paths, name: &str) -> Result<PathBuf, String> {
    let d = paths.private.join(name);
    std::fs::create_dir_all(&d).map_err(|e| format!("could not create {}: {e}", d.display()))?;
    Ok(d)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::bridge::mock::Mock;

    #[test]
    fn a_conversation_is_filed_under_its_project_path() {
        let p = Paths {
            private: std::env::temp_dir().join(format!("fc-hist-{}", std::process::id())),
            codex_home: PathBuf::new(),
        };
        let a = history_file(&p, "/home/a/ring.fc").unwrap();
        assert_eq!(a, history_file(&p, "/home/a/ring.fc").unwrap());
        assert_ne!(a, history_file(&p, "/home/a/band.fc").unwrap());
        assert!(a.starts_with(&p.private));
        let _ = std::fs::remove_dir_all(&p.private);
    }

    /// Talks to the real, signed-in CLIs on this computer: `cargo test -- --ignored --nocapture real_agents`.
    #[tokio::test]
    #[ignore]
    async fn real_agents() {
        let mcp = Mcp::new(Mock::new(|_, _| Ok(serde_json::json!({}))));
        let port = std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port();
        let url = mcp.apply("127.0.0.1", port).await.url.unwrap();
        let dir = std::env::temp_dir().join("fc-real-agents");
        let paths = Paths {
            private: dir.clone(),
            codex_home: std::env::var_os("CODEX_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from(std::env::var("HOME").unwrap()).join(".codex")),
        };
        for e in engines() {
            let info = probe(e.as_ref(), &paths).await;
            eprintln!("{info:?}");
            if !info.available {
                continue;
            }
            let cancel = CancellationToken::new();
            let say = |ev: &Event| eprintln!("  {} {ev:?}", e.id());
            let first = Turn {
                model: None,
                effort: None,
                prompt: "Remember the word PINEAPPLE. Call exec_fc with args \"help\" once, then reply with just OK.",
                session: None,
                mcp_url: &url,
            };
            let r1 = run(e.as_ref(), &first, &paths, &cancel, &say)
                .await
                .unwrap();
            eprintln!("{} first: {r1:?}", e.id());
            assert!(
                r1.session.is_some()
                    && !r1.text.is_empty()
                    && r1.tools.iter().all(|t| t.done && !t.output.is_empty())
            );
            let second = Turn {
                model: None,
                effort: None,
                prompt: "Which word did I ask you to remember? One word.",
                session: r1.session.as_deref(),
                mcp_url: &url,
            };
            let r2 = run(e.as_ref(), &second, &paths, &cancel, &say)
                .await
                .unwrap();
            eprintln!("{} second: {r2:?}", e.id());
            assert!(r2.text.to_uppercase().contains("PINEAPPLE"), "{r2:?}");
        }
    }
}
