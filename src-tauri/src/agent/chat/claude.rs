//! Claude Code, started as `claude -p` with its own tools switched off.

use serde_json::{Value, json};

use super::{
    Engine, Event, Invocation, Kind, Limit, ModelInfo, Part, Paths, ToolCall, Turn, Usage, input_text, subdir,
    with_text_files,
};

pub struct Claude;

const EFFORTS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];

/// The user's message as one line of Claude's stream-json input.
fn message(turn: &Turn) -> Result<String, String> {
    let mut content = Vec::new();
    for f in turn.files {
        match f.kind()? {
            Kind::Image => content.push(json!({
                "type": "image",
                "source": { "type": "base64", "media_type": f.mime, "data": f.data },
            })),
            Kind::Pdf => content.push(json!({
                "type": "document",
                "source": { "type": "base64", "media_type": "application/pdf", "data": f.data },
            })),
            Kind::Text(_) => {}
        }
    }
    let text = with_text_files(turn.prompt, turn.files)?;
    content.push(json!({ "type": "text", "text": text }));
    Ok(json!({ "type": "user", "message": { "role": "user", "content": content } }).to_string() + "\n")
}

impl Engine for Claude {
    fn id(&self) -> &'static str {
        "claude"
    }

    fn label(&self) -> &'static str {
        "Claude"
    }

    fn program(&self) -> &'static str {
        "claude"
    }

    fn probe_args(&self) -> Vec<String> {
        vec!["auth".into(), "status".into()]
    }

    fn judge(&self, _ok: bool, output: &str, _: &Paths) -> Result<String, String> {
        let v: Value = serde_json::from_str(output)
            .map_err(|_| "Not signed in; run `claude auth login`.".to_string())?;
        if v["loggedIn"].as_bool() != Some(true) {
            return Err("Not signed in; run `claude auth login`.".into());
        }
        let who = v["email"].as_str().unwrap_or("signed in");
        Ok(match v["authMethod"].as_str() {
            Some(m) => format!("{who} ({m})"),
            None => who.to_string(),
        })
    }

    fn models(&self) -> Vec<ModelInfo> {
        let m = |id: &str, label: &str, efforts: &[&str]| ModelInfo {
            id: id.into(),
            label: label.into(),
            efforts: efforts.iter().map(|e| e.to_string()).collect(),
        };
        vec![
            m("fable", "Fable", &EFFORTS),
            m("opus", "Opus", &EFFORTS),
            m("sonnet", "Sonnet", &EFFORTS),
            m("haiku", "Haiku", &[]),
        ]
    }

    fn default_efforts(&self) -> Vec<String> {
        EFFORTS.map(String::from).into()
    }

    fn prepare(&self, turn: &Turn, paths: &Paths) -> Result<Invocation, String> {
        let dir = subdir(paths, "claude")?;
        // a file rather than a command-line argument: no quoting to get wrong, on any OS
        let config = dir.join("mcp.json");
        let body = json!({ "mcpServers": { "fc": { "type": "http", "url": turn.mcp_url } } });
        std::fs::write(&config, body.to_string())
            .map_err(|e| format!("could not write {}: {e}", config.display()))?;
        // the manual, as part of the system prompt, rewritten every time so it is never stale
        let manual = dir.join("instructions.md");
        std::fs::write(&manual, turn.instructions)
            .map_err(|e| format!("could not write {}: {e}", manual.display()))?;

        let mut args: Vec<String> = [
            "-p",
            "--output-format",
            "stream-json",
            "--verbose",
            "--include-partial-messages",
            // our server and nothing else: no shell, no file access, no other servers, no user settings
            "--strict-mcp-config",
            "--tools",
            "",
            "--setting-sources",
            "",
            "--allowedTools=mcp__fc__exec_fc",
            "--mcp-config",
        ]
        .map(String::from)
        .into();
        args.push(config.to_string_lossy().into_owned());
        args.push("--append-system-prompt-file".into());
        args.push(manual.to_string_lossy().into_owned());
        for (flag, value) in [("--model", turn.model), ("--effort", turn.effort)] {
            if let Some(v) = value {
                args.push(flag.into());
                args.push(v.into());
            }
        }
        if let Some(id) = turn.session {
            args.push("--resume".into());
            args.push(id.into());
        }
        let stdin = if turn.files.is_empty() {
            turn.prompt.to_string()
        } else {
            // pictures and PDFs need the structured input; the CLI reads one message per line
            args.extend(["--input-format", "stream-json"].map(String::from));
            message(turn)?
        };
        Ok(Invocation {
            args,
            env: Vec::new(),
            dir,
            stdin,
        })
    }

    fn parse(&self, line: &str) -> Vec<Event> {
        let Ok(v) = serde_json::from_str::<Value>(line) else {
            return Vec::new();
        };
        match v["type"].as_str() {
            Some("system") if v["subtype"] == "init" => v["session_id"]
                .as_str()
                .map(|id| vec![Event::Session(id.into())])
                .unwrap_or_default(),
            Some("stream_event") => {
                let e = &v["event"];
                match e["type"].as_str() {
                    Some("content_block_start") if e["content_block"]["type"] == "text" => {
                        vec![Event::Break]
                    }
                    Some("content_block_delta") if e["delta"]["type"] == "text_delta" => e["delta"]
                        ["text"]
                        .as_str()
                        .map(|t| vec![Event::Delta(t.into())])
                        .unwrap_or_default(),
                    _ => Vec::new(),
                }
            }
            Some("rate_limit_event") => {
                let windows = &v["rate_limit_info"]["unifiedWindows"];
                let limits: Vec<Limit> = [("five_hour", "5h"), ("seven_day", "weekly")]
                    .into_iter()
                    .filter_map(|(key, label)| {
                        Some(Limit {
                            label: label.into(),
                            percent: windows[key]["utilization"].as_f64()? * 100.0,
                            resets_at: windows[key]["resetsAt"].as_i64(),
                        })
                    })
                    .collect();
                vec![Event::Usage(Usage {
                    limits,
                    ..Default::default()
                })]
            }
            Some("assistant") => {
                let u = &v["message"]["usage"];
                let n = |k: &str| u[k].as_u64().unwrap_or(0);
                let mut out: Vec<Event> = Vec::new();
                if u.is_object() {
                    out.push(Event::Usage(Usage {
                        context_used: Some(
                            n("input_tokens")
                                + n("cache_read_input_tokens")
                                + n("cache_creation_input_tokens")
                                + n("output_tokens"),
                        ),
                        ..Default::default()
                    }));
                }
                out.extend(
                    v["message"]["content"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .filter(|b| b["type"] == "tool_use")
                        .map(|b| {
                            let n = b["name"].as_str().unwrap_or("tool");
                            Event::ToolStart(ToolCall {
                                id: b["id"].as_str().unwrap_or_default().into(),
                                name: n.strip_prefix("mcp__fc__").unwrap_or(n).into(),
                                input: input_text(&b["input"]),
                                ..Default::default()
                            })
                        }),
                );
                out
            }
            Some("user") => v["message"]["content"]
                .as_array()
                .into_iter()
                .flatten()
                .filter(|b| b["type"] == "tool_result")
                .map(|b| Event::ToolEnd {
                    id: b["tool_use_id"].as_str().unwrap_or_default().into(),
                    output: parts(&b["content"]),
                    error: b["is_error"].as_bool() == Some(true),
                })
                .collect(),
            Some("result") => {
                if v["is_error"].as_bool() == Some(true) {
                    let why = v["result"].as_str().unwrap_or("the agent failed");
                    vec![Event::Failed(why.into())]
                } else {
                    let window = v["modelUsage"]
                        .as_object()
                        .and_then(|m| m.values().find_map(|u| u["contextWindow"].as_u64()));
                    vec![
                        Event::Usage(Usage {
                            context_window: window,
                            ..Default::default()
                        }),
                        Event::Done,
                    ]
                }
            }
            _ => Vec::new(),
        }
    }
}

/// A tool result's content: plain text, or blocks of text and pictures.
fn parts(content: &Value) -> Vec<Part> {
    if let Some(t) = content.as_str() {
        return vec![Part::Text { text: t.into() }];
    }
    content
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|b| match b["type"].as_str()? {
            "text" => Some(Part::Text {
                text: b["text"].as_str()?.into(),
            }),
            "image" => Some(Part::Image {
                mime: b["source"]["media_type"].as_str()?.into(),
                data: b["source"]["data"].as_str()?.into(),
            }),
            _ => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn paths() -> Paths {
        let d = std::env::temp_dir().join(format!("fc-claude-test-{}", std::process::id()));
        Paths {
            private: d,
            codex_home: std::env::temp_dir(),
        }
    }

    #[test]
    fn reads_what_claude_prints() {
        let c = Claude;
        let init = r#"{"type":"system","subtype":"init","session_id":"abc","tools":[]}"#;
        assert_eq!(c.parse(init), vec![Event::Session("abc".into())]);
        let start = r#"{"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}}"#;
        assert_eq!(c.parse(start), vec![Event::Break]);
        let delta = r#"{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}}"#;
        assert_eq!(c.parse(delta), vec![Event::Delta("Hello".into())]);
        let tool = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"x"},{"type":"tool_use","id":"t1","name":"mcp__fc__exec_fc","input":{"args":"look front"}}]}}"#;
        assert_eq!(
            c.parse(tool),
            vec![Event::ToolStart(ToolCall {
                id: "t1".into(),
                name: "exec_fc".into(),
                input: "look front".into(),
                ..Default::default()
            })]
        );
        let result = r#"{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"text","text":"ok"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"AAAA"}}]}]}}"#;
        assert_eq!(
            c.parse(result),
            vec![Event::ToolEnd {
                id: "t1".into(),
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
        assert_eq!(
            c.parse(r#"{"type":"result","is_error":false,"result":"ok","modelUsage":{"m":{"contextWindow":1000}}}"#),
            vec![
                Event::Usage(Usage {
                    context_window: Some(1000),
                    ..Default::default()
                }),
                Event::Done
            ]
        );
        let rl = r#"{"type":"rate_limit_event","rate_limit_info":{"unifiedWindows":{"five_hour":{"utilization":0.57,"resetsAt":5},"seven_day":{"utilization":0.13,"resetsAt":9}}}}"#;
        let Event::Usage(u) = &c.parse(rl)[0] else { panic!() };
        assert_eq!(u.limits.len(), 2);
        assert_eq!((u.limits[0].label.as_str(), u.limits[0].resets_at), ("5h", Some(5)));
        assert!((u.limits[1].percent - 13.0).abs() < 1e-9);
        let a = r#"{"type":"assistant","message":{"usage":{"input_tokens":2,"cache_read_input_tokens":10,"cache_creation_input_tokens":100,"output_tokens":5},"content":[]}}"#;
        assert_eq!(
            c.parse(a),
            vec![Event::Usage(Usage {
                context_used: Some(117),
                ..Default::default()
            })]
        );
        assert_eq!(
            c.parse(r#"{"type":"result","is_error":true,"result":"Not logged in"}"#),
            vec![Event::Failed("Not logged in".into())]
        );
        for noise in [
            "",
            "not json",
            r#"{"type":"user"}"#,
        ] {
            assert!(c.parse(noise).is_empty(), "{noise}");
        }
    }

    #[test]
    fn knows_who_is_signed_in() {
        let p = paths();
        let ok = r#"{"loggedIn":true,"authMethod":"claude.ai","email":"a@b.c"}"#;
        assert_eq!(Claude.judge(true, ok, &p).unwrap(), "a@b.c (claude.ai)");
        assert!(Claude.judge(false, r#"{"loggedIn":false}"#, &p).is_err());
        assert!(Claude.judge(false, "boom", &p).is_err());
    }

    #[test]
    fn pictures_and_text_files_go_in_one_structured_message() {
        use super::super::Attachment;
        let f = |name: &str, mime: &str, data: &str| Attachment {
            name: name.into(),
            mime: mime.into(),
            data: data.into(),
        };
        let files = [f("a.png", "image/png", "aGk="), f("n.txt", "text/plain", "aGk=")];
        let t = Turn {
            model: None,
            effort: None,
            instructions: "",
            prompt: "look",
            files: &files,
            session: None,
            mcp_url: "http://127.0.0.1:1/mcp",
        };
        let inv = Claude.prepare(&t, &paths()).unwrap();
        assert!(inv.args.join(" ").contains("--input-format stream-json"));
        let v: Value = serde_json::from_str(inv.stdin.trim()).unwrap();
        let c = v["message"]["content"].as_array().unwrap();
        assert_eq!(c[0]["type"], "image");
        assert_eq!(c[0]["source"]["data"], "aGk=");
        assert!(c[1]["text"].as_str().unwrap().contains("n.txt"));
    }

    #[test]
    fn only_our_server_and_no_tools_of_its_own() {
        let p = paths();
        let t = Turn {
            model: Some("opus"),
            effort: Some("high"),
            instructions: "THE MANUAL",
            prompt: "hi \"there\"",
            files: &[],
            session: Some("s1"),
            mcp_url: "http://127.0.0.1:1/mcp",
        };
        let inv = Claude.prepare(&t, &p).unwrap();
        let a = inv.args.join(" ");
        assert!(
            a.contains("--strict-mcp-config") && a.contains("--tools  --"),
            "{a}"
        );
        assert!(
            a.contains("--resume s1") && a.contains("--model opus --effort high"),
            "{a}"
        );
        assert_eq!(inv.stdin, "hi \"there\"");
        assert!(
            a.contains("--append-system-prompt-file") && !a.contains("read_instructions"),
            "{a}"
        );
        assert_eq!(
            std::fs::read_to_string(inv.dir.join("instructions.md")).unwrap(),
            "THE MANUAL"
        );
        let cfg = std::fs::read_to_string(inv.dir.join("mcp.json")).unwrap();
        let cfg: Value = serde_json::from_str(&cfg).unwrap();
        assert_eq!(cfg["mcpServers"]["fc"]["url"], "http://127.0.0.1:1/mcp");
        assert_eq!(cfg["mcpServers"].as_object().unwrap().len(), 1);
        let fresh = Claude.prepare(&Turn { session: None, ..t }, &p).unwrap();
        assert!(!fresh.args.contains(&"--resume".to_string()));
        let _ = std::fs::remove_dir_all(&p.private);
    }
}
