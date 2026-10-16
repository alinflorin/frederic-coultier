//! Codex, started as `codex exec --json` in a home folder of ours, so that the only MCP server
//! it knows is this app's.
//!
//! Codex always has a shell tool of its own; it is switched off here, and the sandbox is read-only
//! in an empty folder in case a version ignores that.

use std::path::Path;

use serde_json::Value;

use super::{
    Engine, Event, Invocation, Kind, Limit, ModelInfo, Part, Paths, ToolCall, Turn, Usage, input_text, subdir,
    with_text_files,
};

pub struct Codex;

fn config(url: &str, instructions: &str, all_tools: bool) -> String {
    // a JSON string is a valid TOML string; it has to come before the first table
    let mut s = format!(
        "# written by the app before every run\nsandbox_mode = \"{}\"\nweb_search = \"live\"\ndeveloper_instructions = {}\n",
        // without all tools, the shell can look at files but not change them
        if all_tools { "workspace-write" } else { "read-only" },
        Value::String(instructions.into())
    );
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
        std::fs::write(
            home.join("config.toml"),
            config(turn.mcp_url, turn.instructions, turn.all_tools),
        )
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
        // ask for the reasoning summaries, so there is something to show while it thinks
        args.extend(["-c".into(), "model_reasoning_summary=\"auto\"".into()]);
        args.extend(["--json", "--skip-git-repo-check"].map(String::from));
        if turn.all_tools {
            args.push("--approve-for-me".into());
        }
        // pictures are handed over as files; the rest is text that goes into the prompt
        let pics = subdir(paths, "codex-files")?;
        for old in std::fs::read_dir(&pics).into_iter().flatten().flatten() {
            let _ = std::fs::remove_file(old.path());
        }
        for (i, f) in turn.files.iter().enumerate() {
            match f.kind()? {
                Kind::Image => {
                    let ext = f.mime.rsplit('/').next().unwrap_or("png");
                    let file = pics.join(format!("{i}.{ext}"));
                    std::fs::write(&file, f.bytes()?)
                        .map_err(|e| format!("could not write {}: {e}", file.display()))?;
                    args.extend(["-i".into(), file.to_string_lossy().into_owned()]);
                }
                Kind::Pdf => return Err(format!("Codex cannot read PDF files ({})", f.name)),
                Kind::Text(_) => {}
            }
        }
        args.push("-".into());
        Ok(Invocation {
            args,
            env: vec![("CODEX_HOME".into(), home.to_string_lossy().into_owned())],
            dir: work,
            stdin: with_text_files(turn.prompt, turn.files)?,
        })
    }

    fn usage(&self, paths: &Paths, session: &str) -> Option<Usage> {
        let file = find_rollout(&paths.private.join("codex-home").join("sessions"), session)?;
        let text = std::fs::read_to_string(file).ok()?;
        read_usage(&text)
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
            Some("item.completed") if item["type"] == "reasoning" => item["text"]
                .as_str()
                .map(|t| vec![Event::Thought(format!("\n\n{t}"))])
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

/// Codex's record of a conversation, `rollout-<time>-<session>.jsonl`, in dated folders.
fn find_rollout(dir: &Path, session: &str) -> Option<std::path::PathBuf> {
    let suffix = format!("{session}.jsonl");
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let p = entry.path();
        if p.is_dir() {
            if let Some(found) = find_rollout(&p, session) {
                return Some(found);
            }
        } else if p.file_name().is_some_and(|n| n.to_string_lossy().ends_with(&suffix)) {
            return Some(p);
        }
    }
    None
}

/// The last `token_count` of a record: the size of the conversation and the account's limits.
fn read_usage(record: &str) -> Option<Usage> {
    let v = record
        .lines()
        .rev()
        .filter(|l| l.contains("\"token_count\""))
        .filter_map(|l| serde_json::from_str::<Value>(l).ok())
        .find(|v| v["payload"]["info"].is_object())?;
    let p = &v["payload"];
    let limit = |w: &Value| {
        let minutes = w["window_minutes"].as_i64()?;
        Some(Limit {
            label: match minutes {
                300 => "5h".into(),
                10080 => "weekly".into(),
                m if m % 60 == 0 => format!("{}h", m / 60),
                m => format!("{m}m"),
            },
            percent: w["used_percent"].as_f64()?,
            resets_at: w["resets_at"].as_i64(),
        })
    };
    Some(Usage {
        context_used: p["info"]["last_token_usage"]["total_tokens"].as_u64(),
        context_window: p["info"]["model_context_window"].as_u64(),
        limits: [&p["rate_limits"]["primary"], &p["rate_limits"]["secondary"]]
            .into_iter()
            .filter_map(limit)
            .collect(),
    })
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
    fn the_config_has_our_server_and_the_agents_own_tools() {
        let cfg = config("http://127.0.0.1:45555/mcp", "line one\n\"quoted\" \\ two", true);
        let v: toml_edit_free::Doc = toml_edit_free::parse(&cfg);
        assert_eq!(v.servers, vec!["fc"]);
        assert!(config("u", "i", false).contains("read-only"));
        assert!(!cfg.contains("shell_tool = false") && cfg.contains("workspace-write") && !cfg.contains("danger"));
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
    fn usage_comes_from_the_last_token_count() {
        let record = r#"{"payload":{"type":"token_count","info":null}}
{"payload":{"type":"token_count","info":{"last_token_usage":{"total_tokens":22558},"model_context_window":475000},"rate_limits":{"primary":{"used_percent":5.0,"window_minutes":300,"resets_at":10},"secondary":{"used_percent":21.0,"window_minutes":10080,"resets_at":20}}}}
{"payload":{"type":"token_count","info":null}}"#;
        let u = read_usage(record).unwrap();
        assert_eq!((u.context_used, u.context_window), (Some(22558), Some(475000)));
        assert_eq!(u.limits.len(), 2);
        assert_eq!((u.limits[0].label.as_str(), u.limits[0].percent), ("5h", 5.0));
        assert_eq!(u.limits[1].label, "weekly");
    }

    #[test]
    fn a_run_is_set_up_in_a_home_of_ours() {
        let p = paths("setup");
        let t = Turn {
            model: Some("gpt-6-sol"),
            effort: Some("high"),
            instructions: "THE MANUAL",
            prompt: "hello",
            files: &[],
            session: Some("t9"),
            mcp_url: "http://127.0.0.1:1/mcp",
            all_tools: true,
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
        let cfg = std::fs::read_to_string(Path::new(home).join("config.toml")).unwrap();
        assert!(
            cfg.contains("developer_instructions = \"THE MANUAL\""),
            "{cfg}"
        );
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
