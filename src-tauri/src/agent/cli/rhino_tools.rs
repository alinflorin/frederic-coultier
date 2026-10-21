//! The Rhino plugin's tools as `fc` commands. The plugin (tectopus) has an MCP layer that tells an agent what each
//! tool does and what it takes; those descriptions are kept word for word in `docs/rhino-tools.json` (made from its
//! tool definitions) and are what `help NAME` and `read_instructions` show.
//!
//! A command is named after its tool with dashes (`get_document_info` -> `get-document-info`), and a parameter
//! `foo_bar` is the option `--foo-bar`. Lists of objects (`objects`) are JSON in a here-document.

use std::sync::OnceLock;

use serde::Deserialize;
use serde_json::{Map, Value, json};

use super::Out;
use super::commands::Ctx;
use super::parse::{Flag, Parsed, opt, options, switch};
use super::reference::{Cmd, Opt};

const DATA: &str = include_str!("../../../docs/rhino-tools.json");

/// How the descriptions of these commands read; shown once at the top of the Rhino commands.
pub const INTRO: &str = "\
The commands below are the tools of the Rhino plugin, with the plugin's own descriptions. They act on the document that is open in Rhino, which the user can see. \
A command is the tool's name with dashes (`get_document_info` is `get-document-info`) and a parameter `foo_bar` is the option `--foo-bar`. \
Lists of numbers are comma separated (`--translation 0,0,5`); several ids or names repeat the option (`--ids A --ids B`) or are comma separated; a boolean that is true by default is turned off with `--no-NAME`; nested values (`--bbox`, `--rotation-matrix`) are JSON. \
Lists of objects (`objects` in the descriptions) go in a here-document as JSON, one list per command. \
Lengths are in the document's units (read them with `get-document-info`; the app expects millimetres). \
After a command that changes the document the preview in the app is refreshed by itself.";

#[derive(Deserialize)]
struct RawParam {
    name: String,
    kind: String,
    default: Value,
    required: bool,
}

#[derive(Deserialize)]
struct RawTool {
    group: String,
    tool: String,
    plugin: String,
    doc: String,
    params: Vec<RawParam>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Kind {
    Str,
    Int,
    Float,
    Nums,
    Json,
    Strs,
    Bool,
    Body,
}

struct Param {
    name: &'static str,
    flag: &'static str,
    kind: Kind,
    default: Value,
    required: bool,
}

pub struct Tool {
    pub cmd: Cmd,
    tool: &'static str,
    plugin: &'static str,
    params: Vec<Param>,
    /// Takes its input in a here-document.
    pub body: bool,
    /// Changes the Rhino document, so the preview has to be refreshed after it.
    mutates: bool,
}

fn leak(s: String) -> &'static str {
    Box::leak(s.into_boxed_str())
}

/// Tools that only read.
const READS: &[&str] = &[
    "get_document_info",
    "get_object_info",
    "get_objects_info",
    "get_selected_objects",
    "get_layer_states",
    "get_materials",
    "get_object_materials",
    "get_viewport_info",
    "get_named_views",
    "list_plugins",
    "get_rhino_log",
    "capture_view",
    "invert_rotation_matrix",
    "select_objects",
    "deselect_all",
    "zoom_to_objects",
];

fn type_hint(k: Kind) -> &'static str {
    match k {
        Kind::Str => "TEXT",
        Kind::Int => "N",
        Kind::Float => "NUM",
        Kind::Nums => "A,B,C",
        Kind::Json => "JSON",
        Kind::Strs => "VALUE,...",
        Kind::Bool | Kind::Body => "",
    }
}

fn build() -> Vec<Tool> {
    let raw: Vec<RawTool> = serde_json::from_str(DATA).expect("docs/rhino-tools.json is valid");
    raw.into_iter()
        .map(|t| {
            let name = leak(t.tool.replace('_', "-"));
            let mut flags: Vec<Flag> = Vec::new();
            let mut opts: Vec<Opt> = Vec::new();
            let mut usage = name.to_string();
            let mut params = Vec::new();
            let mut body = false;
            for p in &t.params {
                let kind = match p.kind.as_str() {
                    "int" => Kind::Int,
                    "float" => Kind::Float,
                    "nums" => Kind::Nums,
                    "json" => Kind::Json,
                    "strs" => Kind::Strs,
                    "bool" => Kind::Bool,
                    "body" => Kind::Body,
                    _ => Kind::Str,
                };
                let flag = leak(p.name.replace('_', "-"));
                if kind == Kind::Body {
                    body = true;
                } else if kind == Kind::Bool {
                    let on_by_default = p.default == Value::Bool(true);
                    let off = leak(format!("no-{flag}"));
                    if on_by_default {
                        flags.push(switch(off));
                        flags.push(switch(flag));
                        opts.push(Opt { name: leak(format!("{flag}|{off}")), arg: "", text: "(on by default)" });
                        usage.push_str(&format!(" [--no-{flag}]"));
                    } else {
                        flags.push(switch(flag));
                        opts.push(Opt { name: flag, arg: "", text: "" });
                        usage.push_str(&format!(" [--{flag}]"));
                    }
                } else {
                    flags.push(opt(flag));
                    let arg = match (kind, flag) {
                        (Kind::Strs, f) if f.contains("name") => "NAME,...",
                        (Kind::Strs, f) if f.contains("id") => "ID,...",
                        _ => type_hint(kind),
                    };
                    let default = match &p.default {
                        Value::Null => String::new(),
                        v => format!("default {}", v.to_string().trim_matches('"')),
                    };
                    opts.push(Opt { name: flag, arg, text: leak(default) });
                    usage.push_str(&if p.required { format!(" --{flag} {arg}") } else { format!(" [--{flag} {arg}]") });
                }
                params.push(Param { name: leak(p.name.clone()), flag, kind, default: p.default.clone(), required: p.required });
            }
            if body {
                usage.push_str("   <<EOF");
            }
            let first_line = t.doc.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or("").trim_end_matches(':');
            let mut details = t.doc.clone();
            if body {
                details.push_str("\n\nGive the input (the JSON list, or the code) in a here-document: end the command line with `<<EOF`, then the text, then a line with only `EOF`.");
            }
            Tool {
                cmd: Cmd {
                    group: leak(format!("Rhino: {}", t.group.to_lowercase())),
                    name,
                    usage: leak(usage),
                    summary: leak(first_line.chars().take(110).collect()),
                    details: leak(details),
                    flags: Box::leak(flags.into_boxed_slice()),
                    opts: Box::leak(opts.into_boxed_slice()),
                    examples: &[],
                },
                tool: leak(t.tool.clone()),
                plugin: leak(t.plugin.clone()),
                mutates: !READS.contains(&t.tool.as_str()),
                params,
                body,
            }
        })
        .collect()
}

pub fn tools() -> &'static [Tool] {
    static TOOLS: OnceLock<Vec<Tool>> = OnceLock::new();
    TOOLS.get_or_init(build)
}

pub fn find(name: &str) -> Option<&'static Tool> {
    tools().iter().find(|t| t.cmd.name == name)
}

fn list(p: &Parsed, flag: &str) -> Vec<String> {
    p.values(flag).iter().flat_map(|v| v.split(',')).map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
}

fn number(v: &str, flag: &str) -> Result<f64, String> {
    v.trim().parse::<f64>().ok().filter(|n| n.is_finite()).ok_or_else(|| format!("--{flag} needs a number, got {v:?}"))
}

/// The parameters of the plugin command, from the options.
fn gather(t: &Tool, p: &Parsed) -> Result<Map<String, Value>, String> {
    let mut out = Map::new();
    // a single required text parameter can also be given as plain words: `run-rhino-command Zoom Extents`
    let single = t.params.iter().filter(|x| x.required && x.kind == Kind::Str).count() == 1;
    for x in &t.params {
        match x.kind {
            Kind::Body => {}
            Kind::Bool => {
                let given = p.toggle(x.flag)?;
                match given {
                    Some(b) => {
                        out.insert(x.name.into(), json!(b));
                    }
                    None if !x.default.is_null() => {
                        out.insert(x.name.into(), x.default.clone());
                    }
                    None => {}
                }
            }
            Kind::Str => {
                let v = p.value(x.flag).map(str::to_owned).or_else(|| (single && x.required && !p.pos.is_empty()).then(|| p.pos.join(" ")));
                match v {
                    Some(v) => {
                        out.insert(x.name.into(), json!(v));
                    }
                    None if x.required => return Err(format!("--{} is required", x.flag)),
                    None if !x.default.is_null() => {
                        out.insert(x.name.into(), x.default.clone());
                    }
                    None => {}
                }
            }
            Kind::Int | Kind::Float => match p.value(x.flag) {
                Some(v) => {
                    let n = number(v, x.flag)?;
                    out.insert(x.name.into(), if x.kind == Kind::Int { json!(n as i64) } else { json!(n) });
                }
                None if x.required => return Err(format!("--{} is required", x.flag)),
                None if !x.default.is_null() => {
                    out.insert(x.name.into(), x.default.clone());
                }
                None => {}
            },
            Kind::Nums => {
                let items = list(p, x.flag);
                if items.is_empty() {
                    if x.required {
                        return Err(format!("--{} is required", x.flag));
                    }
                } else {
                    let nums: Result<Vec<f64>, String> = items.iter().map(|s| number(s, x.flag)).collect();
                    out.insert(x.name.into(), json!(nums?));
                }
            }
            Kind::Strs => {
                let items = list(p, x.flag);
                if items.is_empty() {
                    if x.required {
                        return Err(format!("--{} is required", x.flag));
                    }
                } else {
                    out.insert(x.name.into(), json!(items));
                }
            }
            Kind::Json => match p.value(x.flag) {
                Some(v) => {
                    let j: Value = serde_json::from_str(v).map_err(|e| format!("--{} is not valid JSON: {e}", x.flag))?;
                    out.insert(x.name.into(), j);
                }
                None if x.required => return Err(format!("--{} is required", x.flag)),
                None => {}
            },
        }
    }
    Ok(out)
}

fn selector_check(objects: &[Value], what: &str, need: &[&str]) -> Result<(), String> {
    for (i, o) in objects.iter().enumerate() {
        let Some(m) = o.as_object() else {
            return Err(format!("{what}: objects[{i}] must be a dictionary"));
        };
        if need.contains(&"selector") && !m.contains_key("id") && !m.contains_key("name") {
            return Err(format!("{what}: objects[{i}] requires 'id' or 'name'"));
        }
        for k in need.iter().filter(|k| **k != "selector") {
            if !m.contains_key(*k) {
                return Err(format!("{what}: objects[{i}].{k} is required"));
            }
        }
    }
    Ok(())
}

/// The text of a JSON list given in a here-document.
fn objects_from(stdin: Option<&str>, what: &str) -> Result<Vec<Value>, String> {
    let text = stdin.ok_or_else(|| format!("{what} takes a JSON list of objects in a here-document (<<EOF ... EOF)"))?;
    let v: Value = serde_json::from_str(text.trim()).map_err(|e| format!("{what}: the here-document is not valid JSON: {e}"))?;
    match v {
        Value::Array(a) if !a.is_empty() => Ok(a),
        Value::Object(_) => Ok(vec![v]),
        _ => Err(format!("{what}: objects must be a non-empty list")),
    }
}

fn compact(v: &Value) -> String {
    const MAX: usize = 60_000;
    let s = serde_json::to_string(v).unwrap_or_else(|_| v.to_string());
    if s.len() <= MAX {
        return s;
    }
    let mut cut = MAX;
    while !s.is_char_boundary(cut) {
        cut -= 1;
    }
    format!("{}… [cut: {} of {} characters shown; narrow the request (limit, offset, bbox, ids)]", &s[..cut], cut, s.len())
}

fn text_out(text: String) -> Result<Out, String> {
    Ok(Out { text, images: Vec::new() })
}

/// Runs one of the plugin's tools.
pub async fn run(c: &Ctx<'_>, t: &Tool, args: &[String], stdin: Option<&str>) -> Result<Out, String> {
    let p = options(args, t.cmd.flags)?;
    if !t.body && stdin.is_some() {
        return Err(format!("{} does not read a here-document (<<EOF); nothing was done", t.cmd.name));
    }
    let mut params = gather(t, &p)?;
    let what = t.cmd.name;

    match t.tool {
        "invert_rotation_matrix" => return invert(params.get("rotation_matrix")),
        "delete_objects" => {
            if params.get("confirm") != Some(&json!(true)) {
                return Err("delete-objects needs --confirm; it deletes the objects for good".into());
            }
            if !params.contains_key("ids") && !params.contains_key("names") {
                return Err("give --ids or --names".into());
            }
        }
        "create_objects" => {
            let objects = objects_from(stdin, what)?;
            let mut map = Map::new();
            for (i, o) in objects.iter().enumerate() {
                let Some(m) = o.as_object() else { return Err(format!("{what}: objects[{i}] must be a dictionary")) };
                if !m.contains_key("type") {
                    return Err(format!("{what}: objects[{i}].type is required"));
                }
                if !m.get("params").is_some_and(Value::is_object) {
                    return Err(format!("{what}: objects[{i}].params must be a dictionary"));
                }
                let key = m.get("name").and_then(Value::as_str).map_or_else(|| format!("object_{i}"), str::to_owned);
                map.insert(key, o.clone());
            }
            params = map;
        }
        "get_objects_info" | "copy_objects" | "modify_objects" | "rotate_objects" => {
            let all = params.get("all") == Some(&json!(true));
            let objects = if stdin.is_none() && all { Vec::new() } else { objects_from(stdin, what)? };
            let need: &[&str] = if t.tool == "rotate_objects" { &["selector", "rotation_matrix", "pivot"] } else { &["selector"] };
            selector_check(&objects, what, need)?;
            params.insert("objects".into(), json!(objects));
        }
        "execute_rhinoscript_python_code" => {
            let code = stdin.ok_or("give the script in a here-document (<<EOF ... EOF)")?;
            params.insert("code".into(), json!(code));
        }
        "get_log" | "get_rhino_log" => {
            let n = params.get("lines").and_then(Value::as_i64).unwrap_or(20).clamp(1, 100);
            params.insert("lines".into(), json!(n));
        }
        _ => {}
    }

    let slow = matches!(t.tool, "capture_view" | "run_rhino_command" | "execute_rhinoscript_python_code" | "open_file" | "close_file");
    let result = if slow { c.rhino.slow(t.plugin, Value::Object(params)).await? } else { c.rhino.fast(t.plugin, Value::Object(params)).await? };
    let out = shape(t, &result)?;
    if t.mutates {
        // the preview shows what is in the document now (not an error if the window is not there)
        let _ = c.refresh().await;
    }
    Ok(out)
}

fn invert(m: Option<&Value>) -> Result<Out, String> {
    let rows = m.and_then(Value::as_array).filter(|r| r.len() == 3).ok_or("--rotation-matrix must be a 3x3 matrix, e.g. [[1,0,0],[0,1,0],[0,0,1]]")?;
    let mut a = [[0.0f64; 3]; 3];
    for (i, r) in rows.iter().enumerate() {
        let r = r.as_array().filter(|r| r.len() == 3).ok_or("--rotation-matrix must be a 3x3 matrix")?;
        for (j, v) in r.iter().enumerate() {
            a[i][j] = v.as_f64().ok_or("--rotation-matrix must hold numbers")?;
        }
    }
    // the inverse of a rotation is its transpose
    let t: Vec<Vec<f64>> = (0..3).map(|j| (0..3).map(|i| a[i][j]).collect()).collect();
    text_out(compact(&json!({ "rotation_matrix": t })))
}

/// The plugin's answer as the text (and picture) the agent reads.
fn shape(t: &Tool, r: &Value) -> Result<Out, String> {
    match t.tool {
        "capture_view" => {
            let png = r["png_base64"].as_str().ok_or("Capture failed: missing PNG data")?;
            Ok(Out { text: compact(&r["metadata"]), images: vec![(png.to_string(), "image/png".into())] })
        }
        "get_rhino_log" => {
            let entries: Vec<&str> = r["entries"].as_array().into_iter().flatten().filter_map(Value::as_str).collect();
            if entries.is_empty() {
                return text_out("No log entries found.".into());
            }
            let mut s = entries.join("\n");
            if r["truncated"] == json!(true) {
                s = format!("[showing last {} of {} lines]\n{s}", entries.len(), r["total_lines"]);
            }
            text_out(s)
        }
        "run_rhino_command" => {
            let msg = r["message"].as_str().unwrap_or("done").to_string();
            if r["success"] == json!(false) {
                Err(msg)
            } else {
                text_out(msg)
            }
        }
        "execute_rhinoscript_python_code" => {
            if r["success"] == json!(false) {
                return Err(r["message"].as_str().unwrap_or("the script failed").lines().take(6).collect::<Vec<_>>().join("\n"));
            }
            let s = r["result"].as_str().unwrap_or("");
            text_out(s.split_once("Print output:").map_or(s, |(_, o)| o).trim().to_string())
        }
        _ => text_out(compact(r)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_tool_is_described_with_the_plugins_words() {
        let all = tools();
        assert!(all.len() >= 35, "{}", all.len());
        let doc = find("get-document-info").expect("tool");
        assert!(doc.cmd.details.contains("meta_data"), "the description of the MCP layer is kept");
        assert!(doc.cmd.usage.starts_with("get-document-info") && doc.cmd.usage.contains("[--limit N]"), "{}", doc.cmd.usage);
        assert!(find("create-objects").unwrap().cmd.details.contains("SPHERE"), "the types of create_object are included");
        assert!(find("capture-view").unwrap().cmd.usage.contains("[--no-fit]"));
        assert!(find("execute-rhinoscript-python-code").unwrap().body);
        let mut names = std::collections::HashSet::new();
        for t in all {
            assert!(names.insert(t.cmd.name), "{} twice", t.cmd.name);
            assert!(!t.cmd.summary.is_empty(), "{}", t.cmd.name);
        }
    }

    #[test]
    fn options_become_plugin_parameters() {
        let t = find("capture-view").unwrap();
        let p = options(&["--view".into(), "top".into(), "--camera-location".into(), "1,2,3".into(), "--no-fit".into(), "--ids".into(), "a,b".into(), "--width".into(), "800".into()], t.cmd.flags).unwrap();
        let m = gather(t, &p).unwrap();
        assert_eq!(m["view"], "top");
        assert_eq!(m["camera_location"], json!([1.0, 2.0, 3.0]));
        assert_eq!(m["fit"], false);
        assert_eq!(m["ids"], json!(["a", "b"]));
        assert_eq!(m["width"], 800);
        assert_eq!(m["display_mode"], "Shaded", "the tool's own default is sent");
        assert_eq!(m["draw_grid"], false);
    }

    #[test]
    fn a_single_text_parameter_takes_plain_words() {
        let t = find("run-rhino-command").unwrap();
        let p = options(&["Zoom".into(), "Extents".into()], t.cmd.flags).unwrap();
        assert_eq!(gather(t, &p).unwrap()["command"], "Zoom Extents");
        let p = options(&[], t.cmd.flags).unwrap();
        assert!(gather(t, &p).unwrap_err().contains("--command is required"));
    }

    #[test]
    fn rotation_inverse_is_the_transpose() {
        let out = invert(Some(&json!([[0, -1, 0], [1, 0, 0], [0, 0, 1]]))).unwrap();
        assert_eq!(out.text, r#"{"rotation_matrix":[[0.0,1.0,0.0],[-1.0,0.0,0.0],[0.0,0.0,1.0]]}"#);
        assert!(invert(Some(&json!([[1, 0]]))).is_err());
    }

    #[test]
    fn long_answers_are_cut_with_a_hint() {
        let s = compact(&json!({ "x": "a".repeat(70_000) }));
        assert!(s.contains("narrow the request") && s.len() < 61_000);
    }
}
