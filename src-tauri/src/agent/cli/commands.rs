//! The `fc` commands. Each one turns its arguments into operations on the app (through the
//! [`Bridge`]) and prints the answer as short plain text, to keep the agent's token use low.

use std::path::Path;
use std::time::Duration;

use serde_json::{Map, Value, json};

use super::Out;
use super::catalog::COMMANDS;
use super::parse::{self, Flag, Invocation, Parsed, opt, options, short, switch};
use crate::agent::bridge::Bridge;
use crate::agent::text;

const FAST: Duration = Duration::from_secs(20);
/// Rendering, mesh analysis and support generation can take a while on big models.
const SLOW: Duration = Duration::from_secs(180);
/// How long an edit waits for the preview to re-render before reporting back.
const RENDER_WAIT_MS: u64 = 20_000;

pub struct Ctx<'a> {
    pub bridge: &'a dyn Bridge,
    pub kb: &'a super::kb::Source,
}

impl Ctx<'_> {
    async fn op(&self, op: &'static str, args: Value) -> Result<Value, String> {
        self.bridge.call(op, args, FAST).await
    }

    async fn slow(&self, op: &'static str, args: Value) -> Result<Value, String> {
        self.bridge.call(op, args, SLOW).await
    }
}

fn say(text: impl Into<String>) -> Result<Out, String> {
    Ok(Out {
        text: text.into(),
        images: Vec::new(),
    })
}

/// Runs one command. The error text is what the agent reads, so it says how to continue.
pub async fn run(c: &Ctx<'_>, inv: &Invocation) -> Result<Out, String> {
    let mut words = inv.words.as_slice();
    if words.first().map(String::as_str) == Some("fc") {
        words = &words[1..];
    }
    let Some(first) = words.first() else {
        return Err("empty command; try: help".into());
    };
    let (name, args) = match first.as_str() {
        g @ ("src" | "supports" | "kb") => match words.get(1) {
            Some(sub) if !sub.starts_with('-') => (format!("{g} {sub}"), &words[2..]),
            _ => return Err(format!("{g} needs a subcommand; try: help {g}")),
        },
        other => (other.to_string(), &words[1..]),
    };
    let stdin = inv.stdin.as_deref();
    // a stray here-document is an easy mistake: say so before changing anything
    if stdin.is_some()
        && !matches!(
            name.as_str(),
            "src edit" | "src insert" | "src replace" | "src write"
        )
    {
        return Err(format!(
            "{name} does not read a here-document (<<EOF); nothing was changed"
        ));
    }
    let result = match name.as_str() {
        "status" => status(c, args).await,
        "get-project-notes" => get_project_notes(c, args).await,
        "new-project" => new_project(c, args).await,
        "open-project" => open_project(c, args).await,
        "save-project" | "save" => save_project(c, args).await,
        "src cat" => src_cat(c, args).await,
        "src grep" => src_grep(c, args).await,
        "src edit" => src_edit(c, args, stdin).await,
        "src insert" => src_insert(c, args, stdin).await,
        "src replace" => src_replace(c, args, stdin).await,
        "src delete" => src_delete(c, args).await,
        "src write" => src_write(c, args, stdin).await,
        "render" => render(c, args).await,
        "shot" => shot(c, args).await,
        "get" => get(c, args).await,
        "set" => set(c, args).await,
        "check" => check(c, args).await,
        "orient" => orient(c, args).await,
        "supports ls" => supports_ls(c, args).await,
        "supports auto" => supports_auto(c, args).await,
        "supports add" => supports_add(c, args).await,
        "supports rm" => supports_rm(c, args).await,
        "sprue" => sprue(c, args).await,
        "export" => export(c, args).await,
        "kb search" => kb_search(c, args).await,
        "kb cat" => kb_cat(c, args).await,
        "kb ls" => kb_ls(c, args).await,
        "help" => help(args),
        other => return Err(format!("unknown command {other:?}; try: help")),
    };
    result.map_err(|e| match COMMANDS.iter().find(|c| c.name == name) {
        Some(cmd) => format!("{e}\nusage: {}", cmd.usage),
        None => e,
    })
}

// ---- formatting helpers ----

/// A number without noise: at most 2 decimals, no trailing zeros.
fn n(v: f64) -> String {
    let s = format!("{v:.2}");
    s.trim_end_matches('0').trim_end_matches('.').to_string()
}

fn nums(v: &Value) -> String {
    v.as_array()
        .map(|a| {
            a.iter()
                .filter_map(Value::as_f64)
                .map(n)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default()
}

fn size_of(v: &Value) -> String {
    v.as_array()
        .map(|a| {
            a.iter()
                .filter_map(Value::as_f64)
                .map(n)
                .collect::<Vec<_>>()
                .join("×")
        })
        .unwrap_or_default()
}

fn compact(v: &Value) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| v.to_string())
}

fn expect_no_args(args: &[String]) -> Result<(), String> {
    options(args, NO_FLAGS).and_then(|p| {
        if p.pos.is_empty() {
            Ok(())
        } else {
            Err(format!("unexpected argument {:?}", p.pos[0]))
        }
    })
}

/// One readable paragraph out of a `render.wait` reply.
pub fn render_summary(r: &Value) -> String {
    let status = r["status"].as_str().unwrap_or("unknown");
    let mut lines = Vec::new();
    match status {
        "ok" => {
            let tris = r["triangles"].as_u64().unwrap_or(0);
            if tris == 0 {
                lines.push("render: ok, but the model is empty (no geometry)".to_string());
            } else {
                lines.push(format!(
                    "render: ok, {tris} triangles, {} mm, {} ms",
                    size_of(&r["size"]),
                    r["ms"].as_u64().unwrap_or(0)
                ));
            }
        }
        "error" => {
            let e = &r["error"];
            let at = match (e["line"].as_u64(), e["column"].as_u64()) {
                (Some(l), Some(c)) => format!(" at line {l}, column {c}"),
                (Some(l), None) => format!(" at line {l}"),
                _ => String::new(),
            };
            lines.push(format!(
                "render: FAILED{at}: {}",
                e["message"].as_str().unwrap_or("unknown error")
            ));
        }
        "timeout" => {
            lines.push("render: still running; run `render` again in a moment".to_string())
        }
        "stale" => lines.push("render: out of date (a render is pending)".to_string()),
        other => lines.push(format!("render: {other}")),
    }
    for d in r["diagnostics"].as_array().into_iter().flatten().take(10) {
        let line = d["line"]
            .as_u64()
            .map(|l| format!(" (line {l})"))
            .unwrap_or_default();
        lines.push(format!(
            "- {}{}: {}",
            d["severity"].as_str().unwrap_or("note"),
            line,
            d["message"].as_str().unwrap_or("")
        ));
    }
    let echoes: Vec<&str> = r["echoes"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|e| e.as_str())
        .collect();
    for e in echoes.iter().take(10) {
        lines.push(format!("echo: {e}"));
    }
    if echoes.len() > 10 {
        lines.push(format!("… {} more echo lines", echoes.len() - 10));
    }
    lines.join("\n")
}

// ---- project ----

async fn status(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    expect_no_args(args)?;
    let v = c.op("project.info", json!({})).await?;
    if v["open"] != true {
        return say("no project is open; start one with new-project or open-project");
    }
    let sup = &v["supports"];
    let sp = &v["sprue"];
    let on = |b: &Value| if b == &Value::Bool(true) { "on" } else { "off" };
    let mut l = vec![
        format!(
            "project: {}{}{}",
            v["name"].as_str().unwrap_or("?"),
            if v["unsavedChanges"] == true {
                " (unsaved changes)"
            } else {
                ""
            },
            v["path"]
                .as_str()
                .map(|p| format!("  {p}"))
                .unwrap_or_else(|| "  (never saved)".into())
        ),
        format!(
            "source: {} lines, preview {}",
            v["sourceLines"],
            v["preview"].as_str().unwrap_or("?")
        ),
        format!(
            "material: {} ({})",
            v["material"]["metal"].as_str().unwrap_or("?"),
            v["material"]["process"].as_str().unwrap_or("?")
        ),
        format!("tilt: {}°", n(sup["tilt"].as_f64().unwrap_or(0.0))),
        format!(
            "supports: {}, {} ({} auto, {} manual)",
            on(&sup["enabled"]),
            sup["total"],
            sup["auto"],
            sup["manual"]
        ),
        if sp["enabled"] == true {
            format!(
                "sprue: on, ⌀{} × {} mm, {}",
                n(sp["diameter"].as_f64().unwrap_or(0.0)),
                n(sp["length"].as_f64().unwrap_or(0.0)),
                if sp["at"].is_null() {
                    "automatic spot".to_string()
                } else {
                    format!("at {}", nums(&sp["at"]))
                }
            )
        } else {
            "sprue: off".to_string()
        },
        format!("hollow: {}", on(&v["hollow"]["enabled"])),
    ];
    if let Some(notes) = v["notes"].as_str().filter(|s| !s.trim().is_empty()) {
        l.push(format!("notes: {}", notes.trim()));
    }
    say(l.join("\n"))
}

async fn get_project_notes(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    expect_no_args(args)?;
    let v = c.op("project.info", json!({})).await?;
    if v["open"] != true {
        return say("no project is open; start one with new-project or open-project");
    }
    match v["notes"].as_str().filter(|s| !s.trim().is_empty()) {
        Some(notes) => say(notes.trim().to_string()),
        None => say("the project has no notes"),
    }
}

/// The path `save-project` will really write: the app adds `.fc` when the extension is missing.
fn project_file(path: &str) -> std::path::PathBuf {
    let p = Path::new(path);
    if p.extension().and_then(|e| e.to_str()) == Some("fc") {
        return p.to_path_buf();
    }
    let mut name = p.file_name().unwrap_or_default().to_os_string();
    name.push(".fc");
    p.with_file_name(name)
}

async fn new_project(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, NEW_FLAGS)?;
    if let Some(extra) = p.pos.first() {
        return Err(format!("unexpected argument {extra:?}"));
    }
    c.op(
        "project.new",
        json!({ "sample": p.has("sample"), "discard": p.has("discard") }),
    )
    .await?;
    say(if p.has("sample") {
        "ok: new project from the sample ring (not saved yet)"
    } else {
        "ok: new empty project (not saved yet; save it with save-project PATH)"
    })
}

async fn open_project(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, OPEN_FLAGS)?;
    let [path] = p.pos.as_slice() else {
        return Err("give exactly one .fc file path".into());
    };
    let file = Path::new(path);
    if !file.is_absolute() {
        return Err("the path must be absolute".into());
    }
    if file.extension().and_then(|e| e.to_str()) != Some("fc") {
        return Err("project files end in .fc".into());
    }
    if !file.is_file() {
        return Err("that file does not exist".into());
    }
    c.slow(
        "project.open",
        json!({ "path": path, "discard": p.has("discard") }),
    )
    .await?;
    say(format!("ok: opened {path}"))
}

async fn save_project(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, SAVE_FLAGS)?;
    let mut a = Map::new();
    match p.pos.as_slice() {
        [] => {
            if p.has("overwrite") {
                return Err("--overwrite only applies when you give a PATH".into());
            }
        }
        [path] => {
            let file = project_file(path);
            if !file.is_absolute() {
                return Err("the path must be absolute".into());
            }
            if !file.parent().is_some_and(Path::is_dir) {
                return Err("that folder does not exist".into());
            }
            if file.exists() && !p.has("overwrite") {
                return Err(format!(
                    "{} already exists; add --overwrite to replace it",
                    file.display()
                ));
            }
            a.insert("path".into(), json!(path));
        }
        _ => return Err("give at most one path".into()),
    }
    let v = c.slow("project.save", Value::Object(a)).await?;
    say(format!("saved {}", v["path"].as_str().unwrap_or("")))
}

// ---- source ----

async fn source(c: &Ctx<'_>) -> Result<String, String> {
    let cur = c.op("source.get", json!({})).await?;
    cur["source"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| "unexpected reply from the app".into())
}

async fn src_cat(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, NO_FLAGS)?;
    let (offset, limit) = match p.pos.as_slice() {
        [] => (None, None),
        [r] => {
            let (a, b) = parse::range(r)?;
            (Some(a), b.map(|b| (b + 1).saturating_sub(a).max(1)))
        }
        _ => return Err("one range at most".into()),
    };
    say(text::read(&source(c).await?, offset, limit)?)
}

// ---- knowledge base ----

fn count(p: &Parsed, name: &str, default: usize, max: usize) -> Result<usize, String> {
    Ok(match p.number(name)? {
        Some(v) if v >= 1.0 => (v as usize).min(max),
        Some(_) => return Err(format!("--{name} must be at least 1")),
        None => default,
    })
}

async fn kb_search(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, KB_SEARCH_FLAGS)?;
    if p.pos.is_empty() {
        return Err("give the words to look for".into());
    }
    let query = p.pos.join(" ");
    let (top, per_file) = (count(&p, "top", 5, 50)?, count(&p, "per-file", 2, 20)?);
    let lines = if p.has("full") {
        None
    } else {
        Some(count(&p, "lines", 14, 200)?)
    };
    let index = (c.kb)();
    let wanted = p.value("ext").map(|e| super::kb::exts(Some(e)));
    let dirs: Vec<String> = p
        .values("dir")
        .iter()
        .map(|d| d.trim_matches('/').to_string())
        .collect();
    if let Some(bad) = dirs
        .iter()
        .find(|d| !index.docs.iter().any(|x| &x.sub == *d))
    {
        return Err(format!(
            "no subfolder {bad:?} in the knowledge base; try `kb ls`"
        ));
    }
    use super::kb::{Options, files, render};
    let hits = index.search(&query, &|d| {
        (dirs.is_empty() || dirs.contains(&d.sub))
            && wanted.as_ref().is_none_or(|w| super::kb::has_ext(d, w))
    });
    say(if p.has("files") {
        files(&index, &hits, top)
    } else {
        render(
            &index,
            &hits,
            &query,
            &Options {
                top,
                per_file,
                lines,
            },
        )
    })
}

async fn kb_cat(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, NO_FLAGS)?;
    let (path, range) = match p.pos.as_slice() {
        [f] => (f, None),
        [f, r] => (f, Some(parse::range(r)?)),
        _ => return Err("give a path and, optionally, a line range".into()),
    };
    let index = (c.kb)();
    let doc = super::kb::find(&index.docs, path)?;
    let (offset, limit) = match range {
        Some((a, b)) => (Some(a), b.map(|b| (b + 1).saturating_sub(a).max(1))),
        None => (None, None),
    };
    say(text::read(&doc.lines.join("\n"), offset, limit)?)
}

async fn kb_ls(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    expect_no_args(args)?;
    say(super::kb::list(&(c.kb)().docs))
}

async fn src_grep(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, GREP_FLAGS)?;
    let [pattern] = p.pos.as_slice() else {
        return Err("give exactly one pattern".into());
    };
    let o = text::SearchOptions {
        regex: p.has("regex"),
        ignore_case: p.has("ignore-case"),
        context: p
            .number("context")?
            .map_or(0, |n| n.max(0.0) as usize)
            .min(20),
    };
    say(text::search(&source(c).await?, pattern, o)?)
}

/// Reads the source, applies `change`, writes it back; retries when the user typed in between.
async fn edit_source(
    c: &Ctx<'_>,
    retry: bool,
    wait_render: bool,
    change: impl Fn(&str) -> Result<text::Edited, String>,
    snippet: bool,
) -> Result<Out, String> {
    for attempt in 0..3 {
        let cur = c.op("source.get", json!({})).await?;
        let src = cur["source"]
            .as_str()
            .ok_or("unexpected reply from the app")?;
        let rev = cur["rev"].as_u64().ok_or("unexpected reply from the app")?;
        let e = change(src)?;
        let set = json!({ "source": e.source, "expectRev": rev });
        match c.op("source.set", set).await {
            Ok(_) => return edit_report(c, &e, wait_render, snippet).await,
            Err(m) if m.starts_with("conflict") && attempt < 2 && retry => continue,
            Err(m) if m.starts_with("conflict") => {
                return Err("the source changed while you were editing (the user may be typing); read it again with `src cat` and redo the edit".into());
            }
            Err(m) => return Err(m),
        }
    }
    Err("the source kept changing; try again".into())
}

async fn edit_report(
    c: &Ctx<'_>,
    e: &text::Edited,
    wait_render: bool,
    snippet: bool,
) -> Result<Out, String> {
    let mut out = format!("ok: +{} −{} lines", e.delta.added, e.delta.removed);
    if snippet {
        let span = e.last_line.saturating_sub(e.first_line) + 1;
        let from = e.first_line.saturating_sub(2).max(1);
        let body = text::read(
            &e.source,
            Some(from),
            Some(span + 4 + (e.first_line - from).saturating_sub(2)),
        )
        .unwrap_or_default();
        out = format!("{out}, now lines {}–{}\n{body}", e.first_line, e.last_line);
    }
    if wait_render {
        match c
            .slow("render.wait", json!({ "timeoutMs": RENDER_WAIT_MS }))
            .await
        {
            Ok(r) => out = format!("{out}\n{}", render_summary(&r)),
            Err(m) => out = format!("{out}\n(could not read the render result: {m})"),
        }
    }
    say(out)
}

pub(super) const NO_FLAGS: &[Flag] = &[];
pub(super) const KB_SEARCH_FLAGS: &[Flag] = &[
    opt("top"),
    opt("dir"),
    opt("per-file"),
    opt("lines"),
    switch("full"),
    switch("files"),
    opt("ext"),
];
pub(super) const WAIT: &[Flag] = &[switch("no-wait")];
pub(super) const EDIT_FLAGS: &[Flag] = &[switch("no-wait"), switch("all")];
pub(super) const NEW_FLAGS: &[Flag] = &[switch("sample"), switch("discard")];
pub(super) const OPEN_FLAGS: &[Flag] = &[switch("discard")];
pub(super) const SAVE_FLAGS: &[Flag] = &[switch("overwrite")];
pub(super) const GREP_FLAGS: &[Flag] = &[
    short(switch("regex"), 'E'),
    short(switch("ignore-case"), 'i'),
    short(opt("context"), 'C'),
];
pub(super) const CHECK_FLAGS: &[Flag] = &[switch("deep"), switch("simplify")];
pub(super) const SUPPORTS_AUTO_FLAGS: &[Flag] = &[opt("angle"), opt("spacing")];
pub(super) const SUPPORTS_ADD_FLAGS: &[Flag] = &[opt("tip")];
pub(super) const SUPPORTS_RM_FLAGS: &[Flag] = &[switch("auto"), switch("manual"), switch("all")];
pub(super) const SPRUE_FLAGS: &[Flag] = &[
    switch("on"),
    switch("off"),
    opt("diameter"),
    opt("length"),
    opt("at"),
    switch("auto"),
];
pub(super) const EXPORT_FLAGS: &[Flag] = &[
    opt("format"),
    switch("ascii"),
    switch("overwrite"),
    switch("supports"),
    switch("no-supports"),
    switch("simplify"),
    switch("no-simplify"),
    switch("sprue"),
    switch("no-sprue"),
    switch("hollow"),
    switch("no-hollow"),
];

/// The text for a command: the here-document if there is one, else the positional argument.
fn text_arg(p: &Parsed, at: usize, stdin: Option<&str>) -> Result<String, String> {
    match (stdin, p.pos.get(at)) {
        (Some(s), None) => Ok(s.to_string()),
        (None, Some(t)) => Ok(t.clone()),
        (Some(_), Some(_)) => {
            Err("give the text either as a here-document or as an argument, not both".into())
        }
        (None, None) => Err(
            "no text given: pass it as an argument or as a here-document (<<EOF ... EOF)".into(),
        ),
    }
}

async fn src_edit(c: &Ctx<'_>, args: &[String], stdin: Option<&str>) -> Result<Out, String> {
    let p = options(args, EDIT_FLAGS)?;
    let (all, wait) = (p.has("all"), !p.has("no-wait"));
    match (stdin, p.pos.as_slice()) {
        (Some(body), []) => {
            let blocks = text::parse_blocks(body)?;
            let single = blocks.len() == 1;
            edit_source(
                c,
                true,
                wait,
                |s| text::edit_blocks(s, &blocks, all),
                single,
            )
            .await
        }
        (None, [old, new]) => {
            edit_source(c, true, wait, |s| text::edit(s, old, new, all), true).await
        }
        (Some(_), _) => Err("with a here-document, give no OLD/NEW arguments".into()),
        _ => Err(
            "give OLD and NEW as two arguments, or SEARCH/REPLACE blocks as a here-document".into(),
        ),
    }
}

async fn src_insert(c: &Ctx<'_>, args: &[String], stdin: Option<&str>) -> Result<Out, String> {
    let p = options(args, WAIT)?;
    let line: usize = p
        .pos
        .first()
        .and_then(|l| l.parse().ok())
        .ok_or("give the line to insert after (0 = at the start)")?;
    let t = text_arg(&p, 1, stdin)?;
    edit_source(
        c,
        false,
        !p.has("no-wait"),
        |s| text::insert(s, line, &t),
        true,
    )
    .await
}

async fn src_replace(c: &Ctx<'_>, args: &[String], stdin: Option<&str>) -> Result<Out, String> {
    let p = options(args, WAIT)?;
    let (a, b) = parse::range(p.pos.first().ok_or("give the line range to replace")?)?;
    let t = text_arg(&p, 1, stdin)?;
    edit_source(
        c,
        false,
        !p.has("no-wait"),
        |s| text::replace_lines(s, a, b.unwrap_or_else(|| text::line_count(s)), &t),
        true,
    )
    .await
}

async fn src_delete(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, WAIT)?;
    let (a, b) = parse::range(p.pos.first().ok_or("give the line range to delete")?)?;
    edit_source(
        c,
        false,
        !p.has("no-wait"),
        |s| text::replace_lines(s, a, b.unwrap_or_else(|| text::line_count(s)), ""),
        false,
    )
    .await
}

async fn src_write(c: &Ctx<'_>, args: &[String], stdin: Option<&str>) -> Result<Out, String> {
    let p = options(args, WAIT)?;
    let mut t = text_arg(&p, 0, stdin)?;
    if !t.is_empty() && !t.ends_with('\n') {
        t.push('\n');
    }
    edit_source(
        c,
        false,
        !p.has("no-wait"),
        |s| {
            Ok(text::Edited {
                delta: text::write(s, &t),
                first_line: 1,
                last_line: text::line_count(&t).max(1),
                source: t.clone(),
            })
        },
        false,
    )
    .await
}

// ---- render and pictures ----

async fn render(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, WAIT)?;
    if !p.pos.is_empty() {
        return Err(format!("unexpected argument {:?}", p.pos[0]));
    }
    let ms = if p.has("no-wait") { 0 } else { RENDER_WAIT_MS };
    say(render_summary(
        &c.slow("render.wait", json!({ "timeoutMs": ms })).await?,
    ))
}

pub(super) const SHOT_FLAGS: &[Flag] = &[
    opt("view"),
    opt("az"),
    opt("el"),
    opt("zoom"),
    opt("at"),
    switch("ortho"),
    switch("persp"),
    opt("shading"),
    switch("grid"),
    switch("no-grid"),
    switch("axes"),
    switch("no-axes"),
    switch("dims"),
    switch("no-dims"),
    opt("scene"),
    opt("cut"),
    opt("metal"),
    opt("bg"),
    opt("size"),
];

fn one_of(flag: &str, value: &str, allowed: &[&str]) -> Result<String, String> {
    let v = value.to_ascii_lowercase();
    if allowed.contains(&v.as_str()) {
        Ok(v)
    } else {
        Err(format!("--{flag} must be one of {}", allowed.join(", ")))
    }
}

async fn shot(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, SHOT_FLAGS)?;
    if !p.pos.is_empty() {
        return Err(format!("unexpected argument {:?}", p.pos[0]));
    }
    let mut a = Map::new();
    if let Some(v) = p.value("view") {
        a.insert(
            "view".into(),
            json!(one_of(
                "view",
                v,
                &["front", "back", "left", "right", "top", "bottom", "iso"]
            )?),
        );
    }
    for (flag, key) in [("az", "azimuth"), ("el", "elevation"), ("zoom", "zoom")] {
        if let Some(v) = p.number(flag)? {
            a.insert(key.into(), json!(v));
        }
    }
    if let Some(v) = p.number("zoom")?
        && v <= 0.0 {
            return Err("--zoom must be above 0".into());
        }
    if let Some(v) = p.value("at") {
        a.insert("target".into(), json!(parse::point(v)?));
    }
    match (p.has("ortho"), p.has("persp")) {
        (true, true) => return Err("--ortho and --persp contradict each other".into()),
        (true, false) => drop(a.insert("orthographic".into(), json!(true))),
        (false, true) => drop(a.insert("orthographic".into(), json!(false))),
        _ => {}
    }
    if let Some(v) = p.value("shading") {
        a.insert(
            "shading".into(),
            json!(one_of(
                "shading",
                v,
                &["shaded", "edges", "wireframe", "xray"]
            )?),
        );
    }
    for (flag, key) in [("grid", "grid"), ("axes", "axes"), ("dims", "dimensions")] {
        if let Some(b) = p.toggle(flag)? {
            a.insert(key.into(), json!(b));
        }
    }
    if let Some(v) = p.value("scene") {
        a.insert(
            "scene".into(),
            json!(one_of("scene", v, &["model", "print"])?),
        );
    }
    if let Some(v) = p.value("cut") {
        let parts: Vec<&str> = v.split(':').collect();
        let bad =
            || "--cut looks like z:0.5 or z:0.5:flip (axis x, y or z; position 0 to 1)".to_string();
        let axis = one_of(
            "cut",
            parts.first().copied().unwrap_or(""),
            &["x", "y", "z"],
        )
        .map_err(|_| bad())?;
        let pos: f64 = parts
            .get(1)
            .and_then(|t| t.parse().ok())
            .filter(|p| (0.0..=1.0).contains(p))
            .ok_or_else(bad)?;
        let flip = match parts.get(2) {
            None => false,
            Some(&"flip") => true,
            _ => return Err(bad()),
        };
        a.insert(
            "section".into(),
            json!({ "axis": axis, "position": pos, "flip": flip }),
        );
    }
    if let Some(v) = p.value("metal") {
        a.insert("metal_color".into(), json!(v));
    }
    if let Some(v) = p.value("bg") {
        a.insert("background".into(), json!(v));
    }
    if let Some(v) = p.value("size") {
        let (w, h) = v
            .to_ascii_lowercase()
            .split_once('x')
            .and_then(|(w, h)| Some((w.parse::<u32>().ok()?, h.parse::<u32>().ok()?)))
            .ok_or("--size looks like 800x600")?;
        if !(16..=2048).contains(&w) || !(16..=2048).contains(&h) {
            return Err("--size must be between 16 and 2048 pixels each way".into());
        }
        a.insert("width".into(), json!(w));
        a.insert("height".into(), json!(h));
    }
    let v = c.slow("view.capture", Value::Object(a)).await?;
    let png = v["png"]
        .as_str()
        .ok_or("the app returned no picture")?
        .to_owned();
    let note = v["note"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(|s| format!(". {s}"))
        .unwrap_or_default();
    Ok(Out {
        text: format!("{}×{} px{note}", v["width"], v["height"]),
        images: vec![(png, "image/png".into())],
    })
}

// ---- settings ----

async fn get(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, NO_FLAGS)?;
    let mut v = c.op("settings.get", json!({})).await?;
    if let Some(path) = p.pos.first() {
        for key in path.split('.') {
            v = v
                .get(key)
                .cloned()
                .ok_or_else(|| format!("no setting {path:?}; try `get` for the whole list"))?;
        }
    }
    say(compact(&v))
}

/// `1.5` and `true` and `null` and `[1,2,3]` are values; anything else is text.
fn value_of(s: &str) -> Value {
    serde_json::from_str(s).unwrap_or_else(|_| Value::String(s.to_string()))
}

async fn set(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, NO_FLAGS)?;
    if p.pos.is_empty() {
        return Err("give at least one KEY=VALUE".into());
    }
    let mut patch = Value::Object(Map::new());
    for kv in &p.pos {
        let (key, val) = kv
            .split_once('=')
            .ok_or_else(|| format!("{kv:?} is not KEY=VALUE"))?;
        let mut node = &mut patch;
        let parts: Vec<&str> = key.split('.').collect();
        for (i, part) in parts.iter().enumerate() {
            let obj = node
                .as_object_mut()
                .ok_or_else(|| format!("{key:?} conflicts with another setting you gave"))?;
            if i + 1 == parts.len() {
                if obj.insert((*part).into(), value_of(val)).is_some() {
                    return Err(format!("{key:?} conflicts with another setting you gave"));
                }
                break;
            }
            node = obj
                .entry(*part)
                .or_insert_with(|| Value::Object(Map::new()));
        }
    }
    let v = c.slow("settings.patch", json!({ "patch": patch })).await?;
    let changed: Vec<&str> = v["changed"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();
    if changed.is_empty() {
        return say("no change (already set)");
    }
    let shown: Vec<String> = changed
        .iter()
        .map(|path| {
            let now = path
                .split('.')
                .try_fold(&v["settings"], |acc, k| acc.get(k))
                .map(compact)
                .unwrap_or_default();
            format!("{path} = {now}")
        })
        .collect();
    say(format!("ok: {}", shown.join(", ")))
}

// ---- analysis ----

async fn check(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, CHECK_FLAGS)?;
    if !p.pos.is_empty() {
        return Err(format!("unexpected argument {:?}", p.pos[0]));
    }
    let v = c
        .slow(
            "analysis.report",
            json!({ "deepChecks": p.has("deep"), "simplifyPreview": p.has("simplify") }),
        )
        .await?;
    let s = &v["stats"];
    let f = |k: &str| s[k].as_f64().unwrap_or(0.0);
    let mut l = vec![
        format!(
            "size {} mm, volume {} mm³, area {} mm², {} triangles, {} shells",
            size_of(&s["size"]),
            n(f("volume")),
            n(f("area")),
            s["triangles"],
            s["shells"]
        ),
        format!(
            "metal: {} g {}",
            n(v["metalGrams"].as_f64().unwrap_or(0.0)),
            v["metal"].as_str().unwrap_or("")
        ),
        format!(
            "open edges {}, non-manifold {}, winding {}, degenerate {}",
            s["openEdges"], s["nonManifoldEdges"], s["windingEdges"], s["degenerate"]
        ),
    ];
    for fd in v["findings"].as_array().into_iter().flatten() {
        let at: Vec<String> = fd["at"]
            .as_array()
            .into_iter()
            .flatten()
            .take(3)
            .map(|p| format!("({})", nums(p)))
            .collect();
        let more = fd["at"].as_array().map_or(0, |a| a.len().saturating_sub(3));
        let detail = fd["detail"]
            .as_str()
            .filter(|d| !d.is_empty())
            .map(|d| format!(": {d}"))
            .unwrap_or_default();
        l.push(format!(
            "[{}] {}{}{}{}",
            fd["level"].as_str().unwrap_or("?"),
            fd["code"].as_str().unwrap_or("?"),
            detail,
            if at.is_empty() {
                String::new()
            } else {
                format!(" at {}", at.join(" "))
            },
            if more > 0 {
                format!(" +{more} more")
            } else {
                String::new()
            }
        ));
    }
    if let Some(sm) = v["simplify"].as_object() {
        l.push(format!(
            "simplify: {} → {} triangles, volume change {}% — {}",
            sm["before"],
            sm["after"],
            n(sm["volumeChange"].as_f64().unwrap_or(0.0)),
            if sm["accepted"] == true {
                "accepted".to_string()
            } else {
                format!("rejected ({})", sm["reason"].as_str().unwrap_or("?"))
            }
        ));
    }
    say(l.join("\n"))
}

async fn orient(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    expect_no_args(args)?;
    let v = c.slow("analysis.tilt", json!({})).await?;
    let cur = v["current"].as_f64().unwrap_or(0.0);
    let mut l = vec![format!(
        "current tilt {}°; best first (tilt, overhang, flat, printed size, fits)",
        n(cur)
    )];
    for r in v["rows"].as_array().into_iter().flatten().take(8) {
        l.push(format!(
            "{:>4}°  {:>8}  {:>8}  {} mm  {}",
            n(r["tilt"].as_f64().unwrap_or(0.0)),
            n(r["overhang"].as_f64().unwrap_or(0.0)),
            n(r["flat"].as_f64().unwrap_or(0.0)),
            size_of(&r["size"]),
            if r["fits"] == true { "fits" } else { "too big" }
        ));
    }
    l.push("apply one with: set printing.tilt=N".into());
    say(l.join("\n"))
}

// ---- supports and sprue ----

async fn supports_ls(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    expect_no_args(args)?;
    let v = c.slow("supports.get", json!({})).await?;
    let mut l = vec![format!(
        "supports {}, tilt {}°, {} total ({} auto, {} manual); printed size {} mm, {} {}",
        if v["enabled"] == true { "on" } else { "off" },
        n(v["tilt"].as_f64().unwrap_or(0.0)),
        v["total"],
        v["auto"],
        v["manual"],
        size_of(&v["printedSize"]),
        if v["fitsPrinter"] == true {
            "fits"
        } else {
            "does NOT fit"
        },
        v["printer"].as_str().unwrap_or("the printer")
    )];
    let list = v["list"].as_array().cloned().unwrap_or_default();
    if !list.is_empty() {
        l.push("id  x  y  z  source (model coordinates, mm)".into());
    }
    for s in list.iter().take(60) {
        l.push(format!(
            "{}  {}  {}  {}  {}",
            s["id"],
            n(s["x"].as_f64().unwrap_or(0.0)),
            n(s["y"].as_f64().unwrap_or(0.0)),
            n(s["z"].as_f64().unwrap_or(0.0)),
            s["source"].as_str().unwrap_or("?")
        ));
    }
    if list.len() > 60 {
        l.push(format!("… {} more", list.len() - 60));
    }
    say(l.join("\n"))
}

async fn supports_auto(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, SUPPORTS_AUTO_FLAGS)?;
    if !p.pos.is_empty() {
        return Err(format!("unexpected argument {:?}", p.pos[0]));
    }
    let mut a = Map::new();
    if let Some(v) = p.number("angle")? {
        a.insert("overhang_angle".into(), json!(v));
    }
    if let Some(v) = p.number("spacing")? {
        a.insert("spacing".into(), json!(v));
    }
    let v = c.slow("supports.auto", Value::Object(a)).await?;
    say(format!(
        "ok: {} added, {} manual kept, {} blocked; {} supports in total ({} overhanging faces)",
        v["added"], v["kept"], v["blocked"], v["total"], v["overhangFaces"]
    ))
}

async fn supports_add(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, SUPPORTS_ADD_FLAGS)?;
    if p.pos.is_empty() {
        return Err("give at least one point X,Y,Z".into());
    }
    let tip = p.number("tip")?;
    let points: Vec<Value> = p
        .pos
        .iter()
        .map(|s| parse::point(s).map(|[x, y, z]| json!({ "x": x, "y": y, "z": z, "tip": tip })))
        .collect::<Result<_, _>>()?;
    let v = c.slow("supports.add", json!({ "points": points })).await?;
    let ids: Vec<String> = v["added"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|i| i.to_string())
        .collect();
    let off = if v["enabled"] == true {
        ""
    } else {
        " (supports are off: `set printing.supports.enabled=true` to use them)"
    };
    say(format!("ok: added ids {}{off}", ids.join(", ")))
}

async fn supports_rm(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, SUPPORTS_RM_FLAGS)?;
    let kinds: Vec<&str> = ["auto", "manual", "all"]
        .into_iter()
        .filter(|k| p.has(k))
        .collect();
    let mut a = Map::new();
    if !p.pos.is_empty() {
        let ids: Vec<u32> = p
            .pos
            .iter()
            .map(|s| s.parse().map_err(|_| format!("{s:?} is not a support id")))
            .collect::<Result<_, _>>()?;
        a.insert("ids".into(), json!(ids));
    }
    match kinds.as_slice() {
        [] => {}
        [k] => drop(a.insert("kind".into(), json!(k))),
        _ => return Err("give only one of --auto, --manual, --all".into()),
    }
    if a.is_empty() {
        return Err("give support ids, or --auto, --manual or --all".into());
    }
    let v = c.slow("supports.remove", Value::Object(a)).await?;
    say(format!(
        "ok: removed {}, {} left",
        v["removed"].as_array().map_or(0, Vec::len),
        v["remaining"]
    ))
}

async fn sprue(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, SPRUE_FLAGS)?;
    if !p.pos.is_empty() {
        return Err(format!("unexpected argument {:?}", p.pos[0]));
    }
    let mut a = Map::new();
    match (p.has("on"), p.has("off")) {
        (true, true) => return Err("--on and --off contradict each other".into()),
        (true, false) => drop(a.insert("enabled".into(), json!(true))),
        (false, true) => drop(a.insert("enabled".into(), json!(false))),
        _ => {}
    }
    if let Some(v) = p.number("diameter")? {
        a.insert("diameter".into(), json!(v));
    }
    if let Some(v) = p.number("length")? {
        a.insert("length".into(), json!(v));
    }
    if let Some(v) = p.value("at") {
        a.insert("at".into(), json!(parse::point(v)?));
    }
    if p.has("auto") {
        if p.has("at") {
            return Err("give either --at or --auto, not both".into());
        }
        a.insert("auto".into(), json!(true));
    }
    let v = c.slow("sprue.set", Value::Object(a)).await?;
    if v["enabled"] != true {
        return say("sprue: off");
    }
    let place = if v["at"].is_null() {
        "no spot found".to_string()
    } else {
        format!(
            "at {} ({})",
            nums(&v["at"]),
            if v["manualSpot"] == true {
                "manual"
            } else {
                "automatic"
            }
        )
    };
    let warn = if v["placed"] == false {
        "  — NO FREE SPOT on this piece"
    } else {
        ""
    };
    say(format!(
        "sprue: on, ⌀{} × {} mm, {place}{warn}",
        n(v["diameter"].as_f64().unwrap_or(0.0)),
        n(v["length"].as_f64().unwrap_or(0.0))
    ))
}

// ---- export ----

async fn export(c: &Ctx<'_>, args: &[String]) -> Result<Out, String> {
    let p = options(args, EXPORT_FLAGS)?;
    let [path] = p.pos.as_slice() else {
        return Err("give exactly one file path".into());
    };
    let file = Path::new(path);
    let ext = file
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let format = match (p.value("format"), p.has("ascii"), ext.as_str()) {
        (Some(f), _, _) => one_of("format", f, &["stl-bin", "stl-ascii", "obj", "3mf"])?,
        (None, true, "stl") => "stl-ascii".into(),
        (None, _, "stl") => "stl-bin".into(),
        (None, _, "obj") => "obj".into(),
        (None, _, "3mf") => "3mf".into(),
        _ => return Err("cannot tell the format from the file name; end it in .stl, .obj or .3mf, or pass --format".into()),
    };
    let want = if format.starts_with("stl") {
        "stl"
    } else {
        format.as_str()
    };
    if ext != want {
        return Err(format!(
            "the file name must end in .{want} for format {format}"
        ));
    }
    if !file.is_absolute() {
        return Err("the path must be absolute".into());
    }
    if !file.parent().is_some_and(Path::is_dir) {
        return Err("that folder does not exist".into());
    }
    if file.exists() && !p.has("overwrite") {
        return Err("that file already exists; add --overwrite to replace it".into());
    }
    let mut a = Map::new();
    a.insert("path".into(), json!(path));
    a.insert("format".into(), json!(format));
    for key in ["supports", "simplify", "sprue", "hollow"] {
        if let Some(b) = p.toggle(key)? {
            a.insert(key.into(), json!(b));
        }
    }
    let v = c.slow("export.run", Value::Object(a)).await?;
    say(format!(
        "exported {path} ({format}){}",
        if v["supportsBakedIn"] == true {
            ", with supports"
        } else {
            ""
        }
    ))
}

// ---- help ----

fn help(args: &[String]) -> Result<Out, String> {
    if args.is_empty() {
        return say(super::reference::overview());
    }
    say(super::reference::entries(&args.join(" "))?)
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use super::*;
    use crate::agent::bridge::mock::Mock;
    use crate::agent::cli::{Cli, Run};

    type Calls = Vec<(&'static str, Value)>;

    /// A fake app: a source string with a revision, canned answers for the rest.
    struct App {
        mock: Arc<Mock>,
        source: Arc<Mutex<(String, u64)>>,
    }

    fn app(initial: &str) -> App {
        let source = Arc::new(Mutex::new((initial.to_string(), 1u64)));
        let s = source.clone();
        let mock = Mock::new(move |op, args| match op {
            "source.get" => {
                let g = s.lock().unwrap();
                Ok(json!({ "source": g.0, "rev": g.1 }))
            }
            "source.set" => {
                let mut g = s.lock().unwrap();
                if args["expectRev"].as_u64() != Some(g.1) {
                    return Err("conflict: the source changed".into());
                }
                *g = (args["source"].as_str().unwrap().to_string(), g.1 + 1);
                Ok(json!({ "rev": g.1 }))
            }
            "render.wait" => Ok(
                json!({ "status": "ok", "triangles": 120, "size": [10.0, 10.0, 5.0], "ms": 7, "diagnostics": [], "echoes": [] }),
            ),
            "settings.get" => Ok(
                json!({ "printing": { "tilt": 30, "supports": { "enabled": false, "tipRadius": 0.2 } } }),
            ),
            "settings.patch" => Ok(
                json!({ "changed": ["printing.tilt"], "settings": { "printing": { "tilt": 25 } } }),
            ),
            "project.info" => Ok(json!({
                "open": true, "name": "ring", "path": "/tmp/ring.fc", "unsavedChanges": true, "sourceLines": 3, "preview": "ok",
                "material": { "metal": "silver925", "process": "casting" },
                "supports": { "enabled": true, "total": 4, "auto": 3, "manual": 1, "tilt": 30 },
                "sprue": { "enabled": false }, "hollow": { "enabled": false }, "notes": "EU 54"
            })),
            "project.new" | "project.open" => Ok(json!({})),
            "project.save" => {
                Ok(json!({ "path": args["path"].as_str().unwrap_or("/tmp/ring.fc") }))
            }
            "view.capture" => Ok(
                json!({ "png": "AAAA", "width": 800, "height": 600, "note": "Scene: as modelled." }),
            ),
            "supports.add" => Ok(json!({ "added": [5, 6], "enabled": true })),
            "supports.remove" => Ok(json!({ "removed": [5], "remaining": 3 })),
            "supports.auto" => {
                Ok(json!({ "added": 3, "kept": 1, "blocked": 0, "total": 4, "overhangFaces": 22 }))
            }
            "sprue.set" => Ok(
                json!({ "enabled": true, "diameter": 2.0, "length": 5.0, "at": [1.0, 2.0, 3.0], "manualSpot": false, "placed": true }),
            ),
            "export.run" => Ok(json!({ "supportsBakedIn": true })),
            other => Err(format!("unexpected op {other}")),
        });
        App { mock, source }
    }

    impl App {
        async fn fc(&self, input: &str) -> Run {
            Cli::new(self.mock.clone()).run(input).await
        }

        async fn ok(&self, input: &str) -> String {
            let r = self.fc(input).await;
            assert!(r.error.is_none(), "{input:?} failed: {}", r.out.text);
            r.out.text
        }

        async fn err(&self, input: &str) -> String {
            let r = self.fc(input).await;
            assert!(
                r.error.is_some(),
                "{input:?} should fail, printed: {}",
                r.out.text
            );
            r.out.text
        }

        fn src(&self) -> String {
            self.source.lock().unwrap().0.clone()
        }

        fn calls(&self) -> Calls {
            self.mock.calls.lock().unwrap().clone()
        }

        fn last(&self, op: &str) -> Value {
            self.calls()
                .iter()
                .rev()
                .find(|c| c.0 == op)
                .unwrap_or_else(|| panic!("{op} was never called"))
                .1
                .clone()
        }
    }

    #[tokio::test]
    async fn cat_and_grep() {
        let a = app("cube(1);\nsphere(2);\ncylinder(3);\n");
        assert_eq!(a.ok("src cat 2:3").await, "2\tsphere(2);\n3\tcylinder(3);");
        assert!(
            a.ok("fc src cat").await.starts_with("1\tcube(1);"),
            "a leading fc is accepted"
        );
        assert_eq!(
            a.ok("src grep sph").await,
            "2:sphere(2);\n(1 matching lines)"
        );
        assert!(
            a.ok("src grep -E -i -C1 '^SPHERE'")
                .await
                .contains("1-cube(1);")
        );
        assert!(a.err("src grep").await.contains("usage: src grep"));
    }

    #[tokio::test]
    async fn edit_with_arguments_reports_snippet_and_render() {
        let a = app("a = 1;\nb = 2;\n");
        let out = a.ok("src edit 'b = 2;' 'b = 3;'").await;
        assert_eq!(a.src(), "a = 1;\nb = 3;\n");
        assert!(out.starts_with("ok: +1 −1 lines, now lines 2–2"), "{out}");
        assert!(
            out.contains("b = 3;") && out.contains("render: ok, 120 triangles, 10×10×5 mm, 7 ms"),
            "{out}"
        );
        let out = a.ok("src edit 'a = 1;' 'a = 9;' --no-wait").await;
        assert!(!out.contains("render:"), "{out}");
    }

    #[tokio::test]
    async fn edit_with_blocks() {
        let a = app("a = 1;\nb = 2;\nc = 3;\n");
        let out = a.ok("src edit <<EOF\n<<<<<<< SEARCH\na = 1;\n=======\na = 10;\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nc = 3;\n=======\nc = 30;\n>>>>>>> REPLACE\nEOF").await;
        assert_eq!(a.src(), "a = 10;\nb = 2;\nc = 30;\n");
        assert!(out.starts_with("ok: +2 −2 lines"), "{out}");
        // a failing block changes nothing and is named
        let e = a.err("src edit <<EOF\n<<<<<<< SEARCH\na = 10;\n=======\nx\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nnope\n=======\ny\n>>>>>>> REPLACE\nEOF").await;
        assert!(e.contains("block 2") && e.contains("not found"), "{e}");
        assert_eq!(a.src(), "a = 10;\nb = 2;\nc = 30;\n");
    }

    #[tokio::test]
    async fn edit_errors_carry_the_usage() {
        let a = app("x;\nx;\n");
        let e = a.err("src edit x y").await;
        assert!(
            e.contains("2 places") && e.contains("usage: src edit"),
            "{e}"
        );
        assert!(a.err("src edit onlyone").await.contains("OLD and NEW"));
        assert!(
            a.err("src edit 'x;' 'y;' --bogus")
                .await
                .contains("unknown option --bogus")
        );
        assert_eq!(a.src(), "x;\nx;\n");
    }

    #[tokio::test]
    async fn line_commands() {
        let a = app("l1;\nl2;\nl3;\n");
        a.ok("src insert 1 <<EOF\nnew1;\nnew2;\nEOF").await;
        assert_eq!(a.src(), "l1;\nnew1;\nnew2;\nl2;\nl3;\n");
        a.ok("src replace 2:3 'only;'").await;
        assert_eq!(a.src(), "l1;\nonly;\nl2;\nl3;\n");
        a.ok("src delete 2").await;
        assert_eq!(a.src(), "l1;\nl2;\nl3;\n");
        a.ok("src delete 3:").await;
        assert_eq!(a.src(), "l1;\nl2;\n");
        let out = a.ok("src write <<EOF\ncube(5);\nEOF").await;
        assert_eq!(a.src(), "cube(5);\n");
        assert!(out.contains("render: ok"));
        assert!(a.err("src insert 9 x").await.contains("past the end"));
        assert!(a.err("src insert 1").await.contains("no text given"));
        assert!(
            a.err("src insert 1 'a' <<EOF\nb\nEOF")
                .await
                .contains("not both")
        );
    }

    #[tokio::test]
    async fn line_edits_do_not_retry_on_conflict() {
        let a = app("a;\nb;\n");
        let s = a.source.clone();
        // the user types between our read and our write
        let stale = Mock::new(move |op, args| match op {
            "source.get" => Ok(json!({ "source": "a;\nb;\n", "rev": 1 })),
            "source.set" => {
                s.lock().unwrap().1 = 2;
                Err(format!("conflict: {args}"))
            }
            _ => Ok(json!({})),
        });
        let r = Cli::new(stale).run("src insert 1 x").await;
        assert!(r.out.text.contains("read it again"), "{}", r.out.text);
    }

    #[tokio::test]
    async fn status_is_short_text() {
        let a = app("");
        let out = a.ok("status").await;
        for want in [
            "project: ring (unsaved changes)  /tmp/ring.fc",
            "source: 3 lines, preview ok",
            "supports: on, 4 (3 auto, 1 manual)",
            "sprue: off",
            "notes: EU 54",
        ] {
            assert!(out.contains(want), "{want:?} missing from\n{out}");
        }
    }

    #[tokio::test]
    async fn project_notes_are_printed_alone() {
        let a = app("");
        assert_eq!(a.ok("get-project-notes").await.trim(), "EU 54");
    }

    #[tokio::test]
    async fn project_files() {
        let a = app("");
        a.ok("new-project").await;
        assert_eq!(
            a.last("project.new"),
            json!({ "sample": false, "discard": false })
        );
        a.ok("new-project --sample --discard").await;
        assert_eq!(
            a.last("project.new"),
            json!({ "sample": true, "discard": true })
        );
        assert!(
            a.err("new-project now")
                .await
                .contains("unexpected argument")
        );

        // save: its own file, or a new one
        assert!(a.ok("save-project").await.starts_with("saved"));
        assert_eq!(a.last("project.save"), json!({}));
        assert!(
            a.ok("save").await.starts_with("saved"),
            "`save` still works"
        );
        let dir = std::env::temp_dir();
        let path = format!("{}/fc-test-{}.fc", dir.display(), std::process::id());
        a.ok(&format!("save-project {path}")).await;
        assert_eq!(a.last("project.save"), json!({ "path": path }));

        // a file that exists is not replaced without --overwrite, with or without the extension
        std::fs::write(&path, b"x").unwrap();
        assert!(
            a.err(&format!("save-project {path}"))
                .await
                .contains("--overwrite")
        );
        assert!(
            a.err(&format!("save-project {}", path.trim_end_matches(".fc")))
                .await
                .contains("--overwrite")
        );
        a.ok(&format!("save-project {path} --overwrite")).await;

        // open: path checks happen before the app is asked
        let before = a.calls().len();
        for bad in [
            "open-project",
            "open-project rel.fc",
            "open-project /tmp/ring.stl",
            "open-project /no/such/ring.fc",
            "save-project rel.fc",
            "save-project /no/such/dir/x.fc",
            "save-project --overwrite",
            "save-project a b",
        ] {
            a.err(bad).await;
        }
        assert_eq!(a.calls().len(), before, "{:?}", a.calls());
        a.ok(&format!("open-project {path} --discard")).await;
        assert_eq!(
            a.last("project.open"),
            json!({ "path": path, "discard": true })
        );
        std::fs::remove_file(&path).unwrap();
    }

    #[test]
    fn project_file_adds_the_extension_like_the_app_does() {
        assert_eq!(project_file("/a/ring.fc"), Path::new("/a/ring.fc"));
        assert_eq!(project_file("/a/ring"), Path::new("/a/ring.fc"));
        assert_eq!(project_file("/a/ring.stl"), Path::new("/a/ring.stl.fc"));
    }

    #[tokio::test]
    async fn settings_get_and_set() {
        let a = app("");
        assert_eq!(
            a.ok("get printing.supports").await,
            r#"{"enabled":false,"tipRadius":0.2}"#
        );
        assert!(a.err("get printing.nope").await.contains("no setting"));
        let out = a.ok("set printing.tilt=25 printing.supports.enabled=true render.metalColor=#d4af37 printing.sprueAt=null printing.sprueAt2=[1,2,3]").await;
        assert!(out.starts_with("ok: printing.tilt = 25"), "{out}");
        assert_eq!(
            a.last("settings.patch"),
            json!({ "patch": { "printing": { "tilt": 25, "supports": { "enabled": true }, "sprueAt": null, "sprueAt2": [1, 2, 3] }, "render": { "metalColor": "#d4af37" } } })
        );
        assert!(a.err("set tilt").await.contains("not KEY=VALUE"));
        assert!(a.err("set a.b=1 a=2").await.contains("conflicts"));
        assert!(a.err("set a=2 a.b=1").await.contains("conflicts"));
        assert!(a.err("set a=1 a=2").await.contains("conflicts"));
    }

    #[tokio::test]
    async fn shot_options_map_to_the_capture_request() {
        let a = app("");
        let r = a.fc("shot --view TOP --az 30 --el=-20 --zoom 2 --at 1,2,3 --ortho --shading xray --grid --no-axes --dims --scene print --cut z:0.5:flip --metal #d4af37 --bg white --size 800x600").await;
        assert!(r.error.is_none(), "{}", r.out.text);
        assert_eq!(r.out.text, "800×600 px. Scene: as modelled.");
        assert_eq!(
            r.out.images,
            [("AAAA".to_string(), "image/png".to_string())]
        );
        assert_eq!(
            a.last("view.capture"),
            json!({
                "view": "top", "azimuth": 30.0, "elevation": -20.0, "zoom": 2.0, "target": [1.0, 2.0, 3.0], "orthographic": true,
                "shading": "xray", "grid": true, "axes": false, "dimensions": true, "scene": "print",
                "section": { "axis": "z", "position": 0.5, "flip": true }, "metal_color": "#d4af37", "background": "white",
                "width": 800, "height": 600
            })
        );
        // no options: an empty request, the app keeps the user's view
        a.ok("shot").await;
        assert_eq!(a.last("view.capture"), json!({}));
    }

    #[tokio::test]
    async fn shot_rejects_bad_options_before_asking_the_app() {
        let a = app("");
        for bad in [
            "shot --view sideways",
            "shot --zoom 0",
            "shot --zoom abc",
            "shot --at 1,2",
            "shot --ortho --persp",
            "shot --grid --no-grid",
            "shot --cut q:0.5",
            "shot --cut z:2",
            "shot --cut z:0.5:up",
            "shot --size 10x10",
            "shot --size big",
            "shot --shading glossy",
            "shot extra",
        ] {
            a.err(bad).await;
        }
        assert!(a.calls().is_empty(), "{:?}", a.calls());
    }

    #[tokio::test]
    async fn supports_and_sprue() {
        let a = app("");
        assert!(
            a.ok("supports auto --angle 40 --spacing 3")
                .await
                .contains("3 added, 1 manual kept")
        );
        assert_eq!(
            a.last("supports.auto"),
            json!({ "overhang_angle": 40.0, "spacing": 3.0 })
        );
        assert!(
            a.ok("supports add 1,2,3 4,5,6 --tip 0.3")
                .await
                .contains("added ids 5, 6")
        );
        assert_eq!(
            a.last("supports.add"),
            json!({ "points": [{ "x": 1.0, "y": 2.0, "z": 3.0, "tip": 0.3 }, { "x": 4.0, "y": 5.0, "z": 6.0, "tip": 0.3 }] })
        );
        assert!(a.ok("supports rm 5").await.contains("removed 1, 3 left"));
        assert_eq!(a.last("supports.remove"), json!({ "ids": [5] }));
        a.ok("supports rm --manual").await;
        assert_eq!(a.last("supports.remove"), json!({ "kind": "manual" }));
        for bad in [
            "supports rm",
            "supports rm --auto --all",
            "supports rm x",
            "supports add",
            "supports add 1,2",
            "supports",
            "supports bogus",
        ] {
            a.err(bad).await;
        }
        assert!(
            a.ok("sprue --on --diameter 2.5 --at 1,2,3")
                .await
                .contains("sprue: on, ⌀2 × 5 mm, at 1, 2, 3 (automatic)")
        );
        assert_eq!(
            a.last("sprue.set"),
            json!({ "enabled": true, "diameter": 2.5, "at": [1.0, 2.0, 3.0] })
        );
        a.ok("sprue --auto").await;
        assert_eq!(a.last("sprue.set"), json!({ "auto": true }));
        assert!(a.err("sprue --on --off").await.contains("contradict"));
        assert!(a.err("sprue --at 1,2,3 --auto").await.contains("not both"));
    }

    #[tokio::test]
    async fn export_checks_the_path_before_asking_the_app() {
        let a = app("");
        let existing = std::env::current_exe().unwrap();
        for bad in [
            "export relative.obj".to_string(),
            "export /tmp/model.step".to_string(),
            "export /no/such/dir/model.obj".to_string(),
            "export /tmp/model.obj --format stl-bin".to_string(),
            format!("export {}", existing.display()),
            "export".to_string(),
        ] {
            a.err(&bad).await;
        }
        assert!(
            a.calls().is_empty(),
            "nothing may reach the app: {:?}",
            a.calls()
        );
        let dir = std::env::temp_dir();
        let out = a
            .ok(&format!(
                "export {}/fc-test-model.stl --ascii --no-supports --hollow",
                dir.display()
            ))
            .await;
        assert!(out.contains("(stl-ascii), with supports"), "{out}");
        let sent = a.last("export.run");
        assert_eq!(sent["format"], "stl-ascii");
        assert_eq!(sent["supports"], false);
        assert_eq!(sent["hollow"], true);
        assert!(
            sent.get("sprue").is_none(),
            "unset options stay the project's choice"
        );
    }

    #[tokio::test]
    async fn chains_label_their_output_and_stop_at_the_first_error() {
        let a = app("cube(1);\n");
        let out = a.ok("src cat && render").await;
        assert!(
            out.starts_with("$ src cat\n1\tcube(1);\n$ render\nrender: ok"),
            "{out}"
        );
        let r = a.fc("src cat && nonsense && render").await;
        assert!(r.error.is_some());
        assert!(
            r.out.text.contains("$ nonsense\nfc: unknown command")
                && !r.out.text.contains("$ render"),
            "{}",
            r.out.text
        );
    }

    #[tokio::test]
    async fn mistakes_are_explained() {
        let a = app("");
        assert!(a.err("").await.contains("no command"));
        assert!(a.err("'oops").await.contains("unterminated"));
        assert!(a.err("src").await.contains("needs a subcommand"));
        assert!(a.err("frobnicate").await.contains("unknown command"));
        // a here-document for a command that ignores it must not run the command at all
        assert!(
            a.err("set printing.tilt=5 <<EOF\nx\nEOF")
                .await
                .contains("does not read a here-document")
        );
        assert!(a.calls().is_empty());
    }

    #[tokio::test]
    async fn knowledge_base_commands_search_read_and_list() {
        let dir = std::env::temp_dir().join(format!("fc-kb-cmd-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("settings")).unwrap();
        std::fs::create_dir_all(dir.join("casting")).unwrap();
        std::fs::write(
            dir.join("settings/prongs.md"),
            "# Prong settings\n\nFour prongs hold a round stone.\n\nUse 0.8 mm at the base.\n",
        )
        .unwrap();
        std::fs::write(
            dir.join("casting/limits.md"),
            "# Limits\n\nWalls of 0.6 mm in silver.\n",
        )
        .unwrap();
        let source = |dir: Option<std::path::PathBuf>| -> super::super::kb::Source {
            Arc::new(move || {
                let docs = match &dir {
                    Some(d) => {
                        super::super::kb::scan(d, &super::super::kb::exts(None)).unwrap_or_default()
                    }
                    None => Vec::new(),
                };
                Arc::new(super::super::kb::Index::new(docs))
            })
        };
        let cli = |input: &'static str, dir: Option<std::path::PathBuf>| async move {
            super::super::Cli::new(Mock::new(|_, _| Ok(json!({}))))
                .with_kb(source(dir))
                .run(input)
                .await
        };
        let d = Some(dir.clone());

        // nothing in it
        let r = cli("kb ls", None).await;
        assert!(r.out.text.contains("is empty"), "{}", r.out.text);

        let ls = cli("kb ls", d.clone()).await.out.text;
        assert!(ls.contains("2 files") && ls.contains("settings/"), "{ls}");

        let found = cli("kb search prong stone", d.clone()).await.out.text;
        assert!(found.contains("1. settings/prongs.md:1-"), "{found}");
        assert!(!found.contains("casting/limits.md"), "{found}");
        let only = cli("kb search --dir casting walls silver --lines 1", d.clone()).await;
        assert!(
            only.error.is_none() && only.out.text.contains("casting/limits.md"),
            "{}",
            only.out.text
        );
        assert_eq!(
            cli("kb search --files prong", d.clone()).await.out.text,
            "settings/prongs.md"
        );
        let bad_dir = cli("kb search --dir nope prong", d.clone()).await;
        assert!(
            bad_dir.out.text.contains("no subfolder"),
            "{}",
            bad_dir.out.text
        );
        assert!(cli("kb search", d.clone()).await.error.is_some());

        let cat = cli("kb cat settings/prongs.md 3:3", d.clone())
            .await
            .out
            .text;
        assert!(cat.contains("Four prongs"), "{cat}");
        let outside = cli("kb cat ../x.md", d.clone()).await;
        assert!(outside.error.is_some(), "{}", outside.out.text);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn help_lists_every_command() {
        let a = app("");
        let all = a.ok("help").await;
        for c in COMMANDS {
            assert!(all.contains(c.name), "{} missing from help", c.name);
        }
        assert!(a.ok("help src").await.matches("src ").count() >= 6);
        assert!(a.ok("help shot").await.contains("--view V"));
        assert!(a.err("help nothing").await.contains("no command"));
    }

    #[test]
    fn numbers_print_without_noise() {
        assert_eq!(n(2.0), "2");
        assert_eq!(n(2.5), "2.5");
        assert_eq!(n(1.0 / 3.0), "0.33");
        assert_eq!(n(-0.001), "-0");
        assert_eq!(n(10.0), "10");
    }
}
