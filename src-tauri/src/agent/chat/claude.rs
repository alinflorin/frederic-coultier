//! Claude Code, started as `claude -p` with its own tools switched off.

use serde_json::{Value, json};

use super::{Engine, Event, Invocation, Paths, Turn, subdir};

pub struct Claude;

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

    fn prepare(&self, turn: &Turn, paths: &Paths) -> Result<Invocation, String> {
        let dir = subdir(paths, "claude")?;
        // a file rather than a command-line argument: no quoting to get wrong, on any OS
        let config = dir.join("mcp.json");
        let body = json!({ "mcpServers": { "fc": { "type": "http", "url": turn.mcp_url } } });
        std::fs::write(&config, body.to_string())
            .map_err(|e| format!("could not write {}: {e}", config.display()))?;

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
            "--allowedTools=mcp__fc__read_instructions,mcp__fc__exec_fc",
            "--mcp-config",
        ]
        .map(String::from)
        .into();
        args.push(config.to_string_lossy().into_owned());
        if let Some(id) = turn.session {
            args.push("--resume".into());
            args.push(id.into());
        }
        Ok(Invocation {
            args,
            env: Vec::new(),
            dir,
            stdin: turn.prompt.to_string(),
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
            Some("assistant") => v["message"]["content"]
                .as_array()
                .into_iter()
                .flatten()
                .filter(|b| b["type"] == "tool_use")
                .filter_map(|b| b["name"].as_str())
                .map(|n| Event::Tool(n.strip_prefix("mcp__fc__").unwrap_or(n).into()))
                .collect(),
            Some("result") => {
                if v["is_error"].as_bool() == Some(true) {
                    let why = v["result"].as_str().unwrap_or("the agent failed");
                    vec![Event::Failed(why.into())]
                } else {
                    vec![Event::Done]
                }
            }
            _ => Vec::new(),
        }
    }
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
        let tool = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"x"},{"type":"tool_use","name":"mcp__fc__exec_fc","input":{}}]}}"#;
        assert_eq!(c.parse(tool), vec![Event::Tool("exec_fc".into())]);
        assert_eq!(
            c.parse(r#"{"type":"result","is_error":false,"result":"ok"}"#),
            vec![Event::Done]
        );
        assert_eq!(
            c.parse(r#"{"type":"result","is_error":true,"result":"Not logged in"}"#),
            vec![Event::Failed("Not logged in".into())]
        );
        for noise in [
            "",
            "not json",
            r#"{"type":"rate_limit_event"}"#,
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
    fn only_our_server_and_no_tools_of_its_own() {
        let p = paths();
        let t = Turn {
            prompt: "hi \"there\"",
            session: Some("s1"),
            mcp_url: "http://127.0.0.1:1/mcp",
        };
        let inv = Claude.prepare(&t, &p).unwrap();
        let a = inv.args.join(" ");
        assert!(
            a.contains("--strict-mcp-config") && a.contains("--tools  --"),
            "{a}"
        );
        assert!(a.contains("--resume s1"));
        assert_eq!(inv.stdin, "hi \"there\"");
        let cfg = std::fs::read_to_string(inv.dir.join("mcp.json")).unwrap();
        let cfg: Value = serde_json::from_str(&cfg).unwrap();
        assert_eq!(cfg["mcpServers"]["fc"]["url"], "http://127.0.0.1:1/mcp");
        assert_eq!(cfg["mcpServers"].as_object().unwrap().len(), 1);
        let fresh = Claude.prepare(&Turn { session: None, ..t }, &p).unwrap();
        assert!(!fresh.args.contains(&"--resume".to_string()));
        let _ = std::fs::remove_dir_all(&p.private);
    }
}
