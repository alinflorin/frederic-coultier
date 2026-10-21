//! The reference for `fc`, rendered on the fly from the command catalog, so it can never
//! disagree with the commands themselves. The agent's instructions put the user's own notes
//! (`docs/fc-cli.md`) above it.

use serde_json::Value;

use super::catalog;
use super::rhino_tools;
use super::parse::Flag;

/// One documented option. `name` may list alternatives (`grid|no-grid`); each must be a real flag
/// of the command, which a test checks.
pub struct Opt {
    pub name: &'static str,
    /// The placeholder for its value (`N`, `X,Y,Z`), empty for a switch.
    pub arg: &'static str,
    pub text: &'static str,
}

pub struct Cmd {
    pub group: &'static str,
    pub name: &'static str,
    /// One or more synopsis lines (separated by `\n`).
    pub usage: &'static str,
    pub summary: &'static str,
    pub details: &'static str,
    /// The flags the parser accepts: the same list the command itself parses with.
    pub flags: &'static [Flag],
    pub opts: &'static [Opt],
    pub examples: &'static [&'static str],
}

/// How the command line works and what the model is: what the agent needs besides the commands.
const CONCEPTS: &str = "\
## Running commands

- `exec_fc` takes the command line without the leading `fc`: `status`, `src cat 1:40`.
- It only looks like a shell: there are no variables, globs or pipes.
- Join commands with `&&`, `;` or a new line. They run in order and **stop at the first error**; with several, each output is labelled `$ command`.
- Quotes: `'single'` is literal; `\"double\"` understands `\\n`, `\\t`, `\\\"` and `\\\\`.
- Options go anywhere after the command: `--zoom 2`, `--zoom=2`, `-C 3`. A number starting with `-` is a value, not an option.
- **Multi-line text goes in a here-document**: end the command line with `<<EOF` and close it with a line containing only `EOF`. Nothing inside is interpreted, so no escaping is needed. More commands may follow the closing line.
- Errors start with `fc:` and end with the usage of the command.

```
src insert 12 <<EOF
ring = rs.AddTorus((0, 0, 0), 9, 1.2)
rs.ObjectName(ring, \"band\")
EOF
```

## The model

- The design lives in **Rhino**, which runs next to the app and which the user watches. The app shows the same geometry in its own preview (`shot`), and runs the checks, supports, sprue and export on it.
- The **design script** (the Source pane, `src ...`) is RhinoScript: Python (IronPython 2.7, so no f-strings; `print(\"x\")` takes one argument) with `import rhinoscriptsyntax as rs`. Every run in Rhino **replaces what the previous run made** with what the script makes now, on the layer `FC`. Objects you or the user make some other way (the Rhino commands below, or by hand in Rhino) stay until you delete them. Look functions up with `kb functions` and `kb function`.
- The unit is the millimetre (the Rhino document must be in Millimeters: `status` says), **Z up**. Views: *front* looks from −Y towards +Y; *right* from +X; *top* from +Z.
- A project also has settings (material, printing, supports, sprue, hollowing) and a list of supports.
- **Model coordinates** are Rhino's world coordinates, before the piece is tilted for printing. Support and sprue positions are always in model coordinates.
- The **print scene** is the piece as it will be printed: tilted about X by `printing.tilt` degrees, lifted off the plate, with supports, raft and sprue. The **model scene** is the piece as modelled.

A normal loop: `src cat`, `src edit`, read the result the edit prints (what ran in Rhino, and the preview's triangles and size), `shot` to look, `check`, repeat.";

fn flag_label(c: &Cmd, part: &str, arg: &str) -> String {
    let short = c
        .flags
        .iter()
        .find(|f| f.name == part)
        .and_then(|f| f.short)
        .map(|s| format!("-{s}, "))
        .unwrap_or_default();
    format!(
        "`{short}--{part}{}`",
        if arg.is_empty() {
            String::new()
        } else {
            format!(" {arg}")
        }
    )
}

fn opt_line(c: &Cmd, o: &Opt) -> String {
    let labels: Vec<String> = o.name.split('|').map(|p| flag_label(c, p, o.arg)).collect();
    if o.text.is_empty() {
        format!("- {}", labels.join(" / "))
    } else {
        format!("- {} — {}", labels.join(" / "), o.text)
    }
}

/// One command in full: synopsis, what it does, options, examples.
fn entry(c: &Cmd) -> String {
    // a command without arguments needs no synopsis: it would only repeat the heading
    let synopsis = if c.usage == c.name {
        String::new()
    } else {
        format!("```\n{}\n```\n", c.usage)
    };
    let mut s = format!(
        "### `{}`\n{synopsis}{}",
        c.name,
        if c.details.is_empty() {
            c.summary
        } else {
            c.details
        }
    );
    if !c.opts.is_empty() {
        s.push_str("\n\nOptions:\n");
        s.push_str(
            &c.opts
                .iter()
                .map(|o| opt_line(c, o))
                .collect::<Vec<_>>()
                .join("\n"),
        );
    }
    if !c.examples.is_empty() {
        s.push_str(&format!(
            "\n\nExamples:\n```\n{}\n```",
            c.examples.join("\n")
        ));
    }
    s
}

/// `help`: every command in one line, by group.
pub fn overview() -> String {
    let width = catalog::all().iter().map(|c| c.name.len()).max().unwrap_or(0);
    let mut out = String::from(
        "fc commands (`help NAME` shows one in detail; your instructions have the full reference)",
    );
    let mut group = "";
    for c in catalog::all() {
        if c.group != group {
            group = c.group;
            out.push_str(&format!("\n\n{group}"));
        }
        out.push_str(&format!("\n  {:<width$}  {}", c.name, c.summary));
    }
    out
}

/// `help NAME`: one command in detail, or all commands of a family (`help src`, `help supports`).
pub fn entries(query: &str) -> Result<String, String> {
    let q = query.trim().trim_start_matches("fc ").to_ascii_lowercase();
    let exact: Vec<&Cmd> = catalog::all().into_iter().filter(|c| c.name == q).collect();
    let hits: Vec<&Cmd> = if exact.is_empty() {
        catalog::all()
            .into_iter()
            .filter(|c| {
                c.name.split(' ').next() == Some(q.as_str()) || c.group.to_ascii_lowercase() == q
            })
            .collect()
    } else {
        exact
    };
    if hits.is_empty() {
        return Err(format!("no command {query:?}; try: help"));
    }
    Ok(hits
        .iter()
        .map(|c| entry(c))
        .collect::<Vec<_>>()
        .join("\n\n"))
}

/// The settings table, from the rows the app sends: `{ path, values, now, text }`.
fn settings_section(rows: &Value) -> String {
    let mut s = String::from(
        "## Settings\n\nRead with `get [PATH]`, change with `set KEY=VALUE...`. Wrong keys, types and out-of-range values are rejected, and then nothing changes.\n\n| setting | values | now | meaning |\n|---|---|---|---|",
    );
    for r in rows.as_array().into_iter().flatten() {
        let cell = |k: &str| r[k].as_str().unwrap_or("").replace('|', "\\|");
        s.push_str(&format!(
            "\n| `{}` | {} | {} | {} |",
            cell("path"),
            cell("values"),
            cell("now"),
            cell("text")
        ));
    }
    s
}

/// Everything: how to run commands, the model, every command by group, and the settings
/// (`None` when the app could not supply them).
pub fn full(settings: Option<&Value>) -> String {
    let mut s = format!("# fc reference\n\n{CONCEPTS}");
    let mut group = "";
    let mut intro = false;
    for c in catalog::all() {
        if c.group != group {
            group = c.group;
            s.push_str(&format!("\n\n## {group}"));
            if group.starts_with("Rhino:") && !intro {
                intro = true;
                s.push_str(&format!("\n\n{}", rhino_tools::INTRO));
            }
        }
        s.push_str(&format!("\n\n{}", entry(c)));
    }
    s.push_str("\n\n");
    s.push_str(&match settings {
        Some(rows) => settings_section(rows),
        None => "## Settings\n\n(the settings list is unavailable right now; `get` prints the current settings)".to_string(),
    });
    s
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn every_flag_is_documented_and_every_doc_names_a_flag() {
        for c in catalog::all() {
            for f in c.flags {
                assert!(
                    c.opts
                        .iter()
                        .any(|o| o.name.split('|').any(|p| p == f.name)),
                    "`{}` takes --{} but does not document it",
                    c.name,
                    f.name
                );
            }
            for o in c.opts {
                for part in o.name.split('|') {
                    let f = c.flags.iter().find(|f| f.name == part).unwrap_or_else(|| {
                        panic!("`{}` documents --{part}, which it does not take", c.name)
                    });
                    assert_eq!(
                        f.value,
                        !o.arg.is_empty(),
                        "`{}` --{part}: a value needs a placeholder and a switch must not have one",
                        c.name
                    );
                }
            }
        }
    }

    #[test]
    fn every_command_is_described_once() {
        let mut seen = std::collections::HashSet::new();
        for c in catalog::all() {
            assert!(seen.insert(c.name), "{} is listed twice", c.name);
            assert!(
                !c.summary.is_empty() && !c.usage.is_empty() && !c.group.is_empty(),
                "{} lacks text",
                c.name
            );
            assert!(
                c.usage.starts_with(c.name.split(' ').next().unwrap()),
                "usage of {} should start with the command",
                c.name
            );
        }
    }

    #[test]
    fn full_reference_has_everything() {
        let rows = json!([{ "path": "printing.tilt", "values": "0–60", "now": "30", "text": "tilt about X" }]);
        let text = full(Some(&rows));
        for c in catalog::all() {
            assert!(
                text.contains(&format!("### `{}`", c.name)),
                "{} missing",
                c.name
            );
        }
        assert!(text.contains("## Running commands") && text.contains("## The model"));
        assert!(
            text.contains("| `printing.tilt` | 0–60 | 30 | tilt about X |"),
            "{text}"
        );
        assert!(full(None).contains("unavailable"));
    }

    #[test]
    fn options_render_with_short_forms_and_alternatives() {
        let grep = entries("src grep").unwrap();
        assert!(
            grep.contains("`-E, --regex`") && grep.contains("`-C, --context N`"),
            "{grep}"
        );
        let shot = entries("shot").unwrap();
        assert!(
            shot.contains("`--grid` / `--no-grid`") && shot.contains("`--zoom N`"),
            "{shot}"
        );
    }

    #[test]
    fn help_overview_groups_commands() {
        let o = overview();
        for c in catalog::all() {
            assert!(o.contains(c.name));
        }
        assert!(
            o.contains("\n\nSource\n") && o.contains("\n\nSupports and sprue\n"),
            "{o}"
        );
        // the overview is a map, not the manual
        assert!(o.len() < 9000, "{} bytes", o.len());
    }

    #[test]
    fn help_entries_find_commands_and_families() {
        assert_eq!(entries("status").unwrap().matches("### `").count(), 1);
        assert!(entries("src").unwrap().matches("### `").count() >= 6);
        assert!(entries("supports").unwrap().matches("### `").count() >= 4);
        assert_eq!(entries("fc status").unwrap(), entries("status").unwrap());
        assert!(entries("nope").unwrap_err().contains("no command"));
    }

    /// `cargo test print_reference -- --ignored --nocapture` shows what the agent reads.
    #[test]
    #[ignore]
    fn print_reference() {
        let rows = json!([
            { "path": "printing.tilt", "values": "0–60", "now": "30", "text": "tilt of the piece about X when printing (degrees)" },
            { "path": "material.metal", "values": "silver925, gold18y", "now": "silver925", "text": "the metal" }
        ]);
        println!(
            "{}\n\n=========== help ===========\n{}\n\n=========== help src edit ===========\n{}",
            full(Some(&rows)),
            overview(),
            entries("src edit").unwrap()
        );
    }
}
