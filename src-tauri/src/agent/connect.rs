//! One-click setup of the agents that can use the MCP server: each one is told where the
//! server is, either by running its own CLI (`claude mcp add ...`) or by editing its config.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use serde_json::{Map, Value, json};
use tauri::{Manager, State};

use super::Mcp;

/// The name the server gets in every agent.
const NAME: &str = "fc";

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    pub id: &'static str,
    pub name: &'static str,
    /// What the play button runs, as text. `None` while the server is not running or when the
    /// agent cannot be set up from here.
    pub command: Option<String>,
    /// Why the agent cannot be set up from here, or what to know before running.
    pub note: Option<&'static str>,
    pub supported: bool,
}

const AGENTS: [(&str, &str); 5] = [
    ("claude-code", "Claude Code"),
    ("claude-desktop", "Claude Desktop"),
    ("codex", "Codex CLI"),
    ("gemini", "Gemini CLI"),
    ("chatgpt", "ChatGPT Desktop"),
];

/// A program to run. Failing is fine for the clean-up step that removes an older entry.
#[derive(Debug, PartialEq)]
struct Step {
    program: &'static str,
    args: Vec<String>,
    optional: bool,
}

fn step(program: &'static str, args: &[&str], optional: bool) -> Step {
    Step {
        program,
        args: args.iter().map(|a| a.to_string()).collect(),
        optional,
    }
}

/// The commands that register the server with a CLI agent: first drop an older entry (so running
/// it twice, or after a port change, works), then add it.
fn plan(id: &str, url: &str) -> Option<Vec<Step>> {
    Some(match id {
        "claude-code" => vec![
            step("claude", &["mcp", "remove", NAME, "--scope", "user"], true),
            step(
                "claude",
                &[
                    "mcp",
                    "add",
                    "--transport",
                    "http",
                    "--scope",
                    "user",
                    NAME,
                    url,
                ],
                false,
            ),
        ],
        "codex" => vec![
            step("codex", &["mcp", "remove", NAME], true),
            step("codex", &["mcp", "add", NAME, "--url", url], false),
        ],
        "gemini" => vec![
            step("gemini", &["mcp", "remove", "--scope", "user", NAME], true),
            step(
                "gemini",
                &[
                    "mcp",
                    "add",
                    "--transport",
                    "http",
                    "--scope",
                    "user",
                    NAME,
                    url,
                ],
                false,
            ),
        ],
        _ => return None,
    })
}

fn shown(s: &Step) -> String {
    std::iter::once(s.program.to_string())
        .chain(s.args.iter().cloned())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Claude Desktop only starts local programs, so it reaches an HTTP server through `mcp-remote`.
fn desktop_entry(url: &str) -> Value {
    json!({ "command": "npx", "args": ["-y", "mcp-remote", url, "--allow-http"] })
}

fn desktop_config_path(config_dir: &Path) -> PathBuf {
    config_dir.join("Claude").join("claude_desktop_config.json")
}

/// The config file with our server set, everything else in it untouched.
fn merge_desktop_config(existing: Option<&str>, url: &str) -> Result<String, String> {
    let mut root = match existing.map(str::trim).filter(|s| !s.is_empty()) {
        None => Value::Object(Map::new()),
        Some(text) => serde_json::from_str::<Value>(text).map_err(|e| {
            format!("the Claude Desktop config is not valid JSON ({e}); fix or delete it first")
        })?,
    };
    let obj = root
        .as_object_mut()
        .ok_or("the Claude Desktop config is not a JSON object")?;
    let servers = obj
        .entry("mcpServers")
        .or_insert_with(|| Value::Object(Map::new()));
    servers
        .as_object_mut()
        .ok_or("`mcpServers` in the Claude Desktop config is not an object")?
        .insert(NAME.into(), desktop_entry(url));
    serde_json::to_string_pretty(&root)
        .map(|s| s + "\n")
        .map_err(|e| e.to_string())
}

fn connect_desktop(config_dir: &Path, url: &str) -> Result<String, String> {
    let path = desktop_config_path(config_dir);
    let existing = match std::fs::read_to_string(&path) {
        Ok(s) => Some(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(format!("could not read {}: {e}", path.display())),
    };
    let merged = merge_desktop_config(existing.as_deref(), url)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)
            .map_err(|e| format!("could not create {}: {e}", dir.display()))?;
    }
    if existing.is_some() {
        // one copy of what was there, in case the user had something precious in it
        let _ = std::fs::copy(&path, path.with_extension("json.bak"));
    }
    std::fs::write(&path, merged)
        .map_err(|e| format!("could not write {}: {e}", path.display()))?;
    Ok(format!(
        "Written to {}. Restart Claude Desktop (it needs Node.js for `npx`).",
        path.display()
    ))
}

async fn run(s: &Step) -> Result<String, String> {
    // npm installs the CLIs as .cmd shims on Windows, which only the shell finds
    let mut cmd = if cfg!(windows) {
        let mut c = tokio::process::Command::new("cmd");
        c.arg("/C").arg(s.program);
        c
    } else {
        tokio::process::Command::new(s.program)
    };
    cmd.args(&s.args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let child = cmd.spawn().map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => format!(
            "`{}` was not found; is it installed and on the PATH?",
            s.program
        ),
        _ => format!("could not start `{}`: {e}", s.program),
    })?;
    let out = tokio::time::timeout(Duration::from_secs(30), child.wait_with_output())
        .await
        .map_err(|_| format!("`{}` did not finish in 30 seconds", shown(s)))?
        .map_err(|e| e.to_string())?;
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    )
    .trim()
    .to_string();
    if out.status.success() {
        Ok(text)
    } else if cfg!(windows) && out.status.code() == Some(1) && text.contains("not recognized") {
        Err(format!(
            "`{}` was not found; is it installed and on the PATH?",
            s.program
        ))
    } else {
        Err(if text.is_empty() {
            format!("`{}` failed ({})", shown(s), out.status)
        } else {
            text
        })
    }
}

fn info(
    id: &'static str,
    name: &'static str,
    url: Option<&str>,
    config_dir: Option<&Path>,
) -> AgentInfo {
    let mut a = AgentInfo {
        id,
        name,
        command: None,
        note: None,
        supported: true,
    };
    match id {
        "chatgpt" => {
            a.supported = false;
            a.note = Some(
                "ChatGPT only connects to servers on the public internet over HTTPS (Settings, Apps, developer mode), never to one on this computer, so it cannot be set up from here.",
            );
        }
        "claude-desktop" => {
            a.note = Some(
                "Edits claude_desktop_config.json and needs Node.js; restart Claude Desktop afterwards.",
            );
            a.command = url.map(|u| match config_dir {
                Some(d) => format!(
                    "{}: {NAME} = npx -y mcp-remote {u} --allow-http",
                    desktop_config_path(d).display()
                ),
                None => format!("npx -y mcp-remote {u} --allow-http"),
            });
        }
        _ => {
            a.command = url
                .and_then(|u| plan(id, u))
                .and_then(|p| p.last().map(shown))
        }
    }
    a
}

#[tauri::command]
pub async fn mcp_agents(
    app: tauri::AppHandle,
    mcp: State<'_, Arc<Mcp>>,
) -> Result<Vec<AgentInfo>, String> {
    let status = mcp.status().await;
    let dir = app.path().config_dir().ok();
    Ok(AGENTS
        .iter()
        .map(|(id, name)| info(id, name, status.url.as_deref(), dir.as_deref()))
        .collect())
}

/// Registers the running server with one agent; returns what to tell the user.
#[tauri::command]
pub async fn mcp_connect(
    id: String,
    app: tauri::AppHandle,
    mcp: State<'_, Arc<Mcp>>,
) -> Result<String, String> {
    let status = mcp.status().await;
    let url = status
        .url
        .ok_or("the MCP server is not running; start it first")?;
    if id == "claude-desktop" {
        let dir = app.path().config_dir().map_err(|e| e.to_string())?;
        return connect_desktop(&dir, &url);
    }
    let steps = plan(&id, &url).ok_or_else(|| format!("{id} cannot be set up from here"))?;
    let mut last = String::new();
    for s in &steps {
        match run(s).await {
            Ok(out) => last = out,
            Err(e) if s.optional && !e.contains("not found") => {}
            Err(e) => return Err(e),
        }
    }
    Ok(if last.is_empty() {
        "Done.".into()
    } else {
        last
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const URL: &str = "http://127.0.0.1:45555/mcp";

    #[test]
    fn cli_plans_remove_then_add() {
        for id in ["claude-code", "codex", "gemini"] {
            let p = plan(id, URL).unwrap();
            assert_eq!(p.len(), 2, "{id}");
            assert!(
                p[0].optional && p[0].args.contains(&"remove".to_string()),
                "{id}"
            );
            assert!(
                !p[1].optional
                    && p[1].args.contains(&"add".to_string())
                    && p[1].args.contains(&URL.to_string()),
                "{id}"
            );
        }
        assert!(plan("chatgpt", URL).is_none() && plan("claude-desktop", URL).is_none());
    }

    #[test]
    fn shown_commands_are_what_runs() {
        assert_eq!(
            info("claude-code", "Claude Code", Some(URL), None)
                .command
                .as_deref(),
            Some("claude mcp add --transport http --scope user fc http://127.0.0.1:45555/mcp")
        );
        assert_eq!(
            info("codex", "Codex CLI", Some(URL), None)
                .command
                .as_deref(),
            Some("codex mcp add fc --url http://127.0.0.1:45555/mcp")
        );
        assert!(info("codex", "Codex CLI", None, None).command.is_none());
        let chat = info("chatgpt", "ChatGPT Desktop", Some(URL), None);
        assert!(!chat.supported && chat.command.is_none() && chat.note.is_some());
    }

    #[test]
    fn desktop_config_keeps_other_settings() {
        let old = r#"{"theme":"dark","mcpServers":{"other":{"command":"x"}}}"#;
        let v: Value =
            serde_json::from_str(&merge_desktop_config(Some(old), URL).unwrap()).unwrap();
        assert_eq!(v["theme"], "dark");
        assert_eq!(v["mcpServers"]["other"]["command"], "x");
        assert_eq!(v["mcpServers"]["fc"]["args"][2], URL);
        // a new port replaces the old entry
        let again: Value = serde_json::from_str(
            &merge_desktop_config(Some(&v.to_string()), "http://127.0.0.1:1/mcp").unwrap(),
        )
        .unwrap();
        assert_eq!(
            again["mcpServers"]["fc"]["args"][2],
            "http://127.0.0.1:1/mcp"
        );
        // missing or empty file starts fresh; garbage is refused, not overwritten
        assert!(
            merge_desktop_config(None, URL)
                .unwrap()
                .contains("mcp-remote")
        );
        assert!(merge_desktop_config(Some("  "), URL).is_ok());
        assert!(
            merge_desktop_config(Some("{oops"), URL)
                .unwrap_err()
                .contains("not valid JSON")
        );
        assert!(merge_desktop_config(Some("[]"), URL).is_err());
        assert!(merge_desktop_config(Some(r#"{"mcpServers":5}"#), URL).is_err());
    }

    #[test]
    fn desktop_setup_writes_the_file_and_a_backup() {
        let dir = std::env::temp_dir().join(format!("fc-connect-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        connect_desktop(&dir, URL).unwrap();
        let path = desktop_config_path(&dir);
        assert!(std::fs::read_to_string(&path).unwrap().contains(URL));
        connect_desktop(&dir, "http://127.0.0.1:2/mcp").unwrap();
        assert!(path.with_extension("json.bak").exists());
        assert!(std::fs::read_to_string(&path).unwrap().contains(":2/"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn a_missing_program_is_explained() {
        let e = run(&Step {
            program: "fc-no-such-program",
            args: vec![],
            optional: false,
        })
        .await
        .unwrap_err();
        assert!(e.contains("was not found"), "{e}");
    }
}
