//! Codex, started as `codex exec --json` in a home folder of ours, so that the only MCP server
//! it knows is this app's.
//!
//! Codex always has a shell tool of its own; it is switched off here, and the sandbox is read-only
//! in an empty folder in case a version ignores that.

use std::path::Path;

use serde_json::Value;

use super::{
    Engine, Event, Invocation, ModelInfo, Part, Paths, ToolCall, Turn, input_text, subdir,
};

pub struct Codex;

fn config(url: &str) -> String {
    let features = [
        "shell_tool",
        "unified_exec",
        "multi_agent",
        "view_image",
        "apps",
        "image_generation",
        "browser_use",
        "computer_use",
        "goals",
    ];
    let mut s = String::from(
        "# written by the app before every run\nsandbox_mode = \"read-only\"\napproval_policy = \"never\"\n\n[features]\n",
    );
    for f in features {
        s.push_str(&format!("{f} = false\n"));
    }
    s.push_str(&format!(
        "\n[mcp_servers.fc]\nurl = {}\ndefault_tools_approval_mode = \"approve\"\n",
        Value::String(url.into())
    ));
    s
}

/// Makes `to` the same file as `from`: a link, so that a refreshed sign-in is shared; a copy if links are not allowed.
fn share(from: &Path, to: &Path) -> Result<(), String> {
    let _ = std::fs::remove_file(to);
    #[cfg(unix)]
    if std::os::unix::fs::symlink(from, to).is_ok() {
        return Ok(());
    }
    std::fs::copy(from, to).map(|_| ()).map_err(|e| {
        format!(
            "could not reuse the Codex sign-in ({}): {e}",
            from.display()
        )
    })
}

impl Engine for Codex {
    fn id(&self) -> &'static str {
        "codex"
    }

    fn label(&self) -> &'static str {
        "Codex"
    }

    fn program(&self) -> &'static str {
        "codex"
    }

    fn probe_args(&self) -> Vec<String> {
        vec!["login".into(), "status".into()]
    }

    fn judge(&self, ok: bool, output: &str, paths: &Paths) -> Result<String, String> {
        if !ok || !output.to_lowercase().contains("logged in") {
            return Err("Not signed in; run `codex login`.".into());
        }
        if !paths.codex_home.join("auth.json").is_file() {
            return Err("Codex keeps its sign-in somewhere this app cannot reuse; run `codex login` again with file storage.".into());
        }
        Ok(output
            .lines()
            .next()
            .unwrap_or("signed in")
            .trim()
            .to_string())
    }

    fn models_args(&self) -> Option<Vec<String>> {
        Some(vec!["debug".into(), "models".into()])
    }

    fn parse_models(&self, output: &str) -> Vec<ModelInfo> {
        let Ok(v) = serde_json::from_str::<Value>(output) else {
            return Vec::new();
        };
        let mut listed: Vec<(i64, ModelInfo)> = v["models"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|m| m["visibility"] == "list")
            .filter_map(|m| {
                Some((
                    m["priority"].as_i64().unwrap_or(i64::MAX),
                    ModelInfo {
                        id: m["slug"].as_str()?.into(),
                        label: m["display_name"].as_str().or(m["slug"].as_str())?.into(),
                        efforts: m["supported_reasoning_levels"]
                            .as_array()
                            .into_iter()
                            .flatten()
                            .filter_map(|l| l["effort"].as_str().map(String::from))
                            .collect(),
                    },
                ))
            })
            .collect();
        listed.sort_by_key(|(p, _)| *p);
        listed.into_iter().map(|(_, m)| m).collect()
    }

    fn default_efforts(&self) -> Vec<String> {
        ["low", "medium", "high"].map(String::from).into()
    }

    fn prepare(&self, turn: &Turn, paths: &Paths) -> Result<Invocation, String> {
        let home = subdir(paths, "codex-home")?;
        let work = subdir(paths, "codex-work")?;
        std::fs::write(home.join("config.toml"), config(turn.mcp_url))
            .map_err(|e| format!("could not write the Codex settings: {e}"))?;
        share(&paths.codex_home.join("auth.json"), &home.join("auth.json"))?;

        let mut args: Vec<String> = vec!["exec".into()];
        if let Some(id) = turn.session {
            args.push("resume".into());
            args.push(id.into());
        }
        if let Some(m) = turn.model {
            args.extend(["-m".into(), m.into()]);
        }
        if let Some(e) = turn.effort {
            args.extend([
                "-c".into(),
                format!("model_reasoning_effort={}", Value::String(e.into())),
            ]);
        }
        args.extend(["--json", "--skip-git-repo-check", "-"].map(String::from));
        Ok(Invocation {
            args,
            env: vec![("CODEX_HOME".into(), home.to_string_lossy().into_owned())],
            dir: work,
            stdin: turn.prompt.to_string(),
        })
    }

    fn finish(&self, paths: &Paths) {
        // where the sign-in had to be copied, Codex may have refreshed the copy
        let mine = paths.private.join("codex-home").join("auth.json");
        if mine.is_symlink() {
            return;
        }
        let real = paths.codex_home.join("auth.json");
        let newer = |p: &Path| std::fs::metadata(p).and_then(|m| m.modified()).ok();
        if newer(&mine) > newer(&real) {
            let _ = std::fs::copy(&mine, &real);
        }
    }

    fn parse(&self, line: &str) -> Vec<Event> {
        let Ok(v) = serde_json::from_str::<Value>(line) else {
            return Vec::new();
        };
        let item = &v["item"];
        match v["type"].as_str() {
            Some("thread.started") => v["thread_id"]
                .as_str()
                .map(|id| vec![Event::Session(id.into())])
                .unwrap_or_default(),
            Some("item.started") if item["type"] == "mcp_tool_call" => {
                vec![Event::ToolStart(ToolCall {
                    id: item["id"].as_str().unwrap_or_default().into(),
                    name: item["tool"].as_str().unwrap_or("tool").into(),
                    input: input_text(&item["arguments"]),
                    ..Default::default()
                })]
            }
            Some("item.completed") if item["type"] == "mcp_tool_call" => {
                let failed = item["status"] == "failed" || !item["error"].is_null();
                let mut output = parts(&item["result"]["content"]);
                if let Some(m) = item["error"]["message"].as_str() {
                    output.push(Part::Text { text: m.into() });
                }
                vec![Event::ToolEnd {
                    id: item["id"].as_str().unwrap_or_default().into(),
                    output,
                    error: failed,
                }]
            }
            // a whole message at a time, not word by word
            Some("item.completed") if item["type"] == "agent_message" => item["text"]
                .as_str()
                .map(|t| vec![Event::Break, Event::Delta(t.into())])
                .unwrap_or_default(),
            Some("item.completed") if item["type"] == "error" => item["message"]
                .as_str()
                .map(|m| vec![Event::Warn(m.into())])
                .unwrap_or_default(),
            Some("turn.completed") => vec![Event::Done],
            Some("turn.failed") => vec![Event::Failed(
                v["error"]["message"]
                    .as_str()
                    .unwrap_or("the agent failed")
                    .into(),
            )],
            Some("error") => v["message"]
                .as_str()
                .map(|m| vec![Event::Warn(m.into())])
                .unwrap_or_default(),
            _ => Vec::new(),
        }
    }
}

fn parts(content: &Value) -> Vec<Part> {
    content
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|b| match b["type"].as_str()? {
            "text" => Some(Part::Text {
                text: b["text"].as_str()?.into(),
            }),
            "image" => Some(Part::Image {
                mime: b["mimeType"].as_str()?.into(),
                data: b["data"].as_str()?.into(),
            }),
            _ => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn paths(name: &str) -> Paths {
        let d = std::env::temp_dir().join(format!("fc-codex-{name}-{}", std::process::id()));
        std::fs::create_dir_all(d.join(".codex")).unwrap();
        std::fs::write(d.join(".codex").join("auth.json"), "{}").unwrap();
        Paths {
            private: d.join("private"),
            codex_home: d.join(".codex"),
        }
    }

    #[test]
    fn reads_what_codex_prints() {
        let c = Codex;
        assert_eq!(
            c.parse(r#"{"type":"thread.started","thread_id":"t1"}"#),
            vec![Event::Session("t1".into())]
        );
        let call = r#"{"type":"item.started","item":{"id":"i","type":"mcp_tool_call","server":"fc","tool":"exec_fc","status":"in_progress"}}"#;
        assert_eq!(
            c.parse(call),
            vec![Event::ToolStart(ToolCall {
                id: "i".into(),
                name: "exec_fc".into(),
                ..Default::default()
            })]
        );
        let done = r#"{"type":"item.completed","item":{"id":"i","type":"mcp_tool_call","tool":"exec_fc","result":{"content":[{"type":"text","text":"ok"},{"type":"image","data":"AAAA","mimeType":"image/png"}]},"error":null,"status":"completed"}}"#;
        assert_eq!(
            c.parse(done),
            vec![Event::ToolEnd {
                id: "i".into(),
                output: vec![
                    Part::Text { text: "ok".into() },
                    Part::Image {
                        mime: "image/png".into(),
                        data: "AAAA".into()
                    }
                ],
                error: false
            }]
        );
        let msg = r#"{"type":"item.completed","item":{"type":"agent_message","text":"Hi"}}"#;
        assert_eq!(c.parse(msg), vec![Event::Break, Event::Delta("Hi".into())]);
        assert_eq!(
            c.parse(r#"{"type":"turn.completed","usage":{}}"#),
            vec![Event::Done]
        );
        assert_eq!(
            c.parse(r#"{"type":"turn.failed","error":{"message":"quota"}}"#),
            vec![Event::Failed("quota".into())]
        );
        // a warning is only a warning; the turn goes on
        assert!(matches!(
            c.parse(r#"{"type":"item.completed","item":{"type":"error","message":"ignoring x"}}"#)
                [..],
            [Event::Warn(_)]
        ));
        assert!(c.parse(r#"{"type":"turn.started"}"#).is_empty());
        assert!(c.parse("Reading additional input from stdin...").is_empty());
    }

    #[test]
    fn models_come_from_the_catalog_best_first() {
        let out = r#"{"models":[
          {"slug":"b","display_name":"B","visibility":"list","priority":2,"supported_reasoning_levels":[{"effort":"low"},{"effort":"high"}]},
          {"slug":"hidden","visibility":"hide","priority":0,"supported_reasoning_levels":[]},
          {"slug":"a","display_name":"A","visibility":"list","priority":1,"supported_reasoning_levels":[]}]}"#;
        let m = Codex.parse_models(out);
        assert_eq!(
            m.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(),
            ["a", "b"]
        );
        assert_eq!(m[1].efforts, ["low", "high"]);
        assert!(Codex.parse_models("garbage").is_empty());
    }

    #[test]
    fn the_config_has_our_server_alone_and_no_shell() {
        let cfg = config("http://127.0.0.1:45555/mcp");
        let v: toml_edit_free::Doc = toml_edit_free::parse(&cfg);
        assert_eq!(v.servers, vec!["fc"]);
        assert!(cfg.contains("shell_tool = false") && cfg.contains("sandbox_mode = \"read-only\""));
        assert!(cfg.contains("url = \"http://127.0.0.1:45555/mcp\""));
    }

    /// Just enough of a reader to count the `[mcp_servers.*]` tables.
    mod toml_edit_free {
        pub struct Doc {
            pub servers: Vec<String>,
        }
        pub fn parse(s: &str) -> Doc {
            let servers = s
                .lines()
                .filter_map(|l| l.trim().strip_prefix("[mcp_servers.")?.strip_suffix(']'))
                .map(String::from)
                .collect();
            Doc { servers }
        }
    }

    #[test]
    fn a_run_is_set_up_in_a_home_of_ours() {
        let p = paths("setup");
        let t = Turn {
            model: Some("gpt-6-sol"),
            effort: Some("high"),
            prompt: "hello",
            session: Some("t9"),
            mcp_url: "http://127.0.0.1:1/mcp",
        };
        let inv = Codex.prepare(&t, &p).unwrap();
        assert_eq!(inv.args[..3], ["exec", "resume", "t9"]);
        assert_eq!(inv.args.last().unwrap(), "-");
        let a = inv.args.join(" ");
        assert!(
            a.contains("-m gpt-6-sol") && a.contains("model_reasoning_effort=\"high\""),
            "{a}"
        );
        assert_eq!(inv.stdin, "hello");
        let home = &inv.env.iter().find(|(k, _)| k == "CODEX_HOME").unwrap().1;
        assert!(Path::new(home).join("config.toml").is_file());
        assert!(
            Path::new(home).join("auth.json").exists(),
            "the sign-in is shared"
        );
        let fresh = Codex.prepare(&Turn { session: None, ..t }, &p).unwrap();
        assert_eq!(fresh.args[0], "exec");
        assert_ne!(fresh.args[1], "resume");
        let _ = std::fs::remove_dir_all(p.codex_home.parent().unwrap());
    }

    #[test]
    fn signed_in_means_logged_in_and_a_file_to_share() {
        let p = paths("judge");
        assert_eq!(
            Codex.judge(true, "Logged in using ChatGPT", &p).unwrap(),
            "Logged in using ChatGPT"
        );
        assert!(Codex.judge(false, "Not logged in", &p).is_err());
        std::fs::remove_file(p.codex_home.join("auth.json")).unwrap();
        assert!(Codex.judge(true, "Logged in using ChatGPT", &p).is_err());
        let _ = std::fs::remove_dir_all(p.codex_home.parent().unwrap());
    }
}
