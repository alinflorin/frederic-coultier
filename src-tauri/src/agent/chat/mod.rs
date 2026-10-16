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
    Tool(String),
    /// Something went wrong that may or may not matter; kept in case the run ends badly.
    Warn(String),
    /// The turn ended well.
    Done,
    /// The turn ended badly.
    Failed(String),
}

/// Where the engines may work.
pub struct Paths {
    /// A folder of ours for scratch files and for the engines' own session storage.
    pub private: PathBuf,
    /// Where Codex keeps its sign-in (`CODEX_HOME`, or `.codex` in the user's home folder).
    pub codex_home: PathBuf,
}

pub struct Turn<'a> {
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
}

async fn probe(e: &dyn Engine, paths: &Paths) -> EngineInfo {
    let mut c = command(e.program());
    c.args(e.probe_args())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let verdict = match c.spawn() {
        Err(err) => Err(not_found(e.program(), &err)),
        Ok(child) => {
            match tokio::time::timeout(Duration::from_secs(15), child.wait_with_output()).await {
                Err(_) => Err(format!("`{}` did not answer in 15 seconds", e.program())),
                Ok(Err(err)) => Err(err.to_string()),
                Ok(Ok(out)) => {
                    let text = format!(
                        "{}{}",
                        String::from_utf8_lossy(&out.stdout),
                        String::from_utf8_lossy(&out.stderr)
                    );
                    e.judge(out.status.success(), text.trim(), paths)
                }
            }
        }
    };
    EngineInfo {
        id: e.id(),
        label: e.label(),
        available: verdict.is_ok(),
        detail: verdict.unwrap_or_else(|why| why),
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
    pub tools: Vec<String>,
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
                Event::Tool(t) => reply.tools.push(t.clone()),
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
struct Wire<'a> {
    kind: &'a str,
    text: &'a str,
}

/// Sends one message to the agent and waits for its whole answer. What it says is also sent as
/// `chat-event`s while it is still working.
#[tauri::command]
pub async fn chat_send(
    engine_id: String,
    prompt: String,
    session: Option<String>,
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
        let (kind, text) = match ev {
            Event::Delta(t) => ("delta", t.as_str()),
            Event::Tool(t) => ("tool", t.as_str()),
            _ => return,
        };
        let _ = app.emit("chat-event", Wire { kind, text });
    };
    let turn = Turn {
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
                prompt: "Remember the word PINEAPPLE. Call exec_fc with args \"help\" once, then reply with just OK.",
                session: None,
                mcp_url: &url,
            };
            let r1 = run(e.as_ref(), &first, &paths, &cancel, &say)
                .await
                .unwrap();
            eprintln!("{} first: {r1:?}", e.id());
            assert!(r1.session.is_some() && !r1.text.is_empty() && !r1.tools.is_empty());
            let second = Turn {
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
