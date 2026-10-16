//! `fc`, a command line that only exists inside the MCP server. The agent gets two tools
//! (`read_instructions` and `exec_fc`) instead of dozens of tool definitions, which keeps the
//! tool list tiny. `read_instructions` returns the user's own notes (`docs/fc-cli.md`) followed
//! by a reference that is generated from the command catalog.

mod catalog;
mod commands;
pub mod kb;
pub mod parse;
mod reference;

use std::sync::Arc;
use std::time::Duration;

use serde_json::json;

use super::bridge::Bridge;

/// The user's own instructions for the agent, kept in `docs/fc-cli.md`.
const NOTES: &str = include_str!("../../../docs/fc-cli.md");

/// Removes `<!-- ... -->` comments, which are for whoever edits the notes, not for the agent.
fn strip_comments(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find("<!--") {
        out.push_str(&rest[..start]);
        match rest[start..].find("-->") {
            Some(end) => rest = &rest[start + end + 3..],
            None => return out.trim().to_string(),
        }
    }
    out.push_str(rest);
    out.trim().to_string()
}

/// The user's notes. In debug builds they are read from disk every time, so edits show up without a rebuild.
pub fn notes() -> String {
    #[cfg(debug_assertions)]
    if let Ok(text) =
        std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/docs/fc-cli.md"))
    {
        return strip_comments(&text);
    }
    strip_comments(NOTES)
}

/// What a command printed: text, and pictures (base64, mime type).
#[derive(Debug, Default)]
pub struct Out {
    pub text: String,
    pub images: Vec<(String, String)>,
}

/// The outcome of a whole `exec_fc` call: everything printed, and the error that stopped it, if any.
pub struct Run {
    pub out: Out,
    pub error: Option<String>,
}

/// A failure before any command ran: the message is also the output, so the agent sees it.
fn fail(message: String) -> Run {
    Run {
        out: Out {
            text: message.clone(),
            images: Vec::new(),
        },
        error: Some(message),
    }
}

#[derive(Clone)]
pub struct Cli {
    bridge: Arc<dyn Bridge>,
    kb: kb::Source,
}

impl Cli {
    pub fn new(bridge: Arc<dyn Bridge>) -> Self {
        Self {
            bridge,
            kb: kb::baked(),
        }
    }

    /// Reads the knowledge base from somewhere else than the program (tests).
    #[cfg(test)]
    pub fn with_kb(mut self, kb: kb::Source) -> Self {
        self.kb = kb;
        self
    }

    /// What `read_instructions` returns: the user's notes, then the generated reference
    /// (with the settings list, which the app itself supplies).
    pub async fn instructions(&self) -> String {
        let settings = self
            .bridge
            .call("settings.schema", json!({}), Duration::from_secs(5))
            .await
            .ok();
        let reference = reference::full(settings.as_ref());
        let notes = notes();
        if notes.is_empty() {
            reference
        } else {
            format!("{notes}\n\n---\n\n{reference}")
        }
    }

    /// Runs the commands in `input` in order and stops at the first one that fails.
    pub async fn run(&self, input: &str) -> Run {
        let commands = match parse::parse(input) {
            Ok(c) => c,
            Err(e) => return fail(format!("fc: {e}")),
        };
        if commands.is_empty() {
            return fail("fc: no command given; try `help`".into());
        }
        let ctx = commands::Ctx {
            bridge: self.bridge.as_ref(),
            kb: &self.kb,
        };
        let several = commands.len() > 1;
        let (mut text, mut images) = (Vec::new(), Vec::new());
        for inv in &commands {
            let label = inv
                .words
                .iter()
                .take(2)
                .cloned()
                .collect::<Vec<_>>()
                .join(" ");
            match commands::run(&ctx, inv).await {
                Ok(out) => {
                    text.push(if several {
                        format!("$ {label}\n{}", out.text)
                    } else {
                        out.text
                    });
                    images.extend(out.images);
                }
                Err(e) => {
                    text.push(if several {
                        format!("$ {label}\nfc: {e}")
                    } else {
                        format!("fc: {e}")
                    });
                    return Run {
                        out: Out {
                            text: text.join("\n"),
                            images,
                        },
                        error: Some(e),
                    };
                }
            }
        }
        Run {
            out: Out {
                text: text.join("\n"),
                images,
            },
            error: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::agent::bridge::mock::Mock;

    #[test]
    fn comments_are_not_sent() {
        assert_eq!(
            strip_comments("<!-- note -->\nHello\n<!-- more\nlines -->\nWorld "),
            "Hello\n\nWorld"
        );
        assert_eq!(strip_comments("no comments"), "no comments");
        assert_eq!(strip_comments("kept <!-- never closed"), "kept");
        assert_eq!(strip_comments("<!-- only -->"), "");
    }

    #[tokio::test]
    async fn instructions_put_the_notes_above_the_reference() {
        let rows =
            json!([{ "path": "printing.tilt", "values": "0–60", "now": "30", "text": "tilt" }]);
        let cli = Cli::new(Mock::new(move |op, _| {
            if op == "settings.schema" {
                Ok(rows.clone())
            } else {
                Err("no".into())
            }
        }));
        let text = cli.instructions().await;
        let notes = notes();
        let at_notes = if notes.is_empty() {
            0
        } else {
            text.find(&notes).expect("the notes are included")
        };
        let at_ref = text
            .find("# fc reference")
            .expect("the reference is included");
        assert!(at_notes < at_ref, "notes first");
        assert!(text.contains("| `printing.tilt` | 0–60 | 30 | tilt |"));
        assert!(!text.contains("<!--"), "comments must be stripped");
    }

    #[tokio::test]
    async fn instructions_survive_an_app_that_does_not_answer() {
        let cli = Cli::new(Mock::new(|_, _| Err("no window".into())));
        let text = cli.instructions().await;
        assert!(
            text.contains("### `src edit`") && text.contains("settings list is unavailable"),
            "{text}"
        );
    }
}
