//! The connection to Rhino. A plugin inside Rhino (tectopus, <https://github.com/Creative-Data-Critical-Design/tectopus>)
//! listens on a local TCP port (1999) and answers one JSON command at a time:
//! `{"type": "get_document_info", "params": {...}}` -> `{"status": "success", "result": {...}}`.
//!
//! The app uses it two ways: the `fc` commands forward the plugin's tools as they are, and the preview runs the
//! design script in Rhino and gets the resulting geometry back as an STL (see [`Rhino::run_design`]).

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::{Value, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::mesh::Mesh;

pub const DEFAULT_HOST: &str = "127.0.0.1";
pub const DEFAULT_PORT: u16 = 1999;

/// The layer the design script's objects are put on; the next run replaces what is on it.
pub const DESIGN_LAYER: &str = "FC";

/// The name of the throwaway object made before each script run (see `run_design`).
const GUARD: &str = "__fc_guard";

const CONNECT_TIMEOUT: Duration = Duration::from_secs(2);
const FAST: Duration = Duration::from_secs(20);
const SLOW: Duration = Duration::from_secs(120);
/// How long a status stays fresh. Every call to the plugin is echoed in Rhino's command history, so
/// the indicator in the window must not ask more often than it needs to.
const STATUS_TTL: Duration = Duration::from_secs(10);
/// STL points are f32; vertices closer than this (mm) are the same vertex.
const WELD_MM: f64 = 1e-4;

/// What the window shows about Rhino.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RhinoStatus {
    pub connected: bool,
    pub host: String,
    pub port: u16,
    pub error: Option<String>,
    /// The open document's file name, if it has been saved.
    pub document: Option<String>,
    pub units: Option<String>,
    /// Millimetres per model unit; 1 for a document in millimetres.
    pub unit_mm: Option<f64>,
    pub objects: Option<u64>,
}

/// Millimetres in one of Rhino's unit systems (`UnitSystem` names), if known.
pub fn unit_mm(units: &str) -> Option<f64> {
    Some(match units {
        "Microns" => 0.001,
        "Millimeters" => 1.0,
        "Centimeters" => 10.0,
        "Meters" => 1000.0,
        "Kilometers" => 1e6,
        "Microinches" => 25.4e-6,
        "Mils" => 0.0254,
        "Inches" => 25.4,
        "Feet" => 304.8,
        "Yards" => 914.4,
        "Miles" => 1_609_344.0,
        _ => return None,
    })
}

/// The design script failed in Rhino.
#[derive(Debug, Clone)]
pub struct ScriptError {
    pub message: String,
}

/// What a design run produced.
pub struct Design {
    pub mesh: Mesh,
    /// What the script printed.
    pub echoes: Vec<String>,
    pub warnings: Vec<String>,
    pub ms: u64,
}

/// Why a design run failed: the script's own error (the document is as it was), or something else.
pub enum RunError {
    Script(ScriptError),
    Other(String),
}

impl From<String> for RunError {
    fn from(s: String) -> Self {
        RunError::Other(s)
    }
}

struct Config {
    host: String,
    port: u16,
}

#[derive(Default)]
struct DesignState {
    /// Ids of the objects the last successful run made.
    ids: HashSet<String>,
    /// Whether this app session has replaced what an earlier session left on the design layer.
    swept: bool,
}

pub struct Rhino {
    cfg: Mutex<Config>,
    conn: tokio::sync::Mutex<Option<TcpStream>>,
    status: Mutex<Option<(Instant, RhinoStatus)>>,
    design: Mutex<DesignState>,
    /// A folder both this app and Rhino can reach; the STL goes through it.
    exchange: PathBuf,
    seq: std::sync::atomic::AtomicU64,
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

impl Rhino {
    pub fn new(host: &str, port: u16, exchange: PathBuf) -> Self {
        Self {
            cfg: Mutex::new(Config { host: host.to_string(), port }),
            conn: tokio::sync::Mutex::new(None),
            status: Mutex::new(None),
            design: Mutex::new(DesignState::default()),
            exchange,
            seq: std::sync::atomic::AtomicU64::new(0),
        }
    }

    pub fn address(&self) -> (String, u16) {
        let c = lock(&self.cfg);
        (c.host.clone(), c.port)
    }

    /// Points the client somewhere else (the next call connects there).
    pub async fn configure(&self, host: &str, port: u16) {
        {
            let mut c = lock(&self.cfg);
            c.host = host.trim().to_string();
            c.port = port;
        }
        *self.conn.lock().await = None;
        *lock(&self.status) = None;
    }

    // ---- the wire ----

    async fn exchange_once(stream: &mut TcpStream, request: &[u8]) -> Result<Value, String> {
        stream.write_all(request).await.map_err(|e| e.to_string())?;
        let mut buf: Vec<u8> = Vec::new();
        let mut chunk = vec![0u8; 1 << 16];
        loop {
            let n = stream.read(&mut chunk).await.map_err(|e| e.to_string())?;
            if n == 0 {
                return Err("Rhino closed the connection".into());
            }
            buf.extend_from_slice(&chunk[..n]);
            // the plugin sends one JSON object with no framing: try to parse when it could be complete
            if buf.iter().rev().find(|b| !b.is_ascii_whitespace()) == Some(&b'}')
                && let Ok(v) = serde_json::from_slice::<Value>(&buf)
            {
                return Ok(v);
            }
        }
    }

    /// Sends one command and returns its `result`. Never sends a command twice: a call that failed
    /// after it was sent may have run.
    pub async fn call(&self, kind: &str, params: Value, timeout: Duration) -> Result<Value, String> {
        let (host, port) = self.address();
        let request = serde_json::to_vec(&json!({ "type": kind, "params": params })).map_err(|e| e.to_string())?;
        let mut guard = self.conn.lock().await;
        let reused = guard.is_some();
        if guard.is_none() {
            let connect = TcpStream::connect((host.as_str(), port));
            let s = tokio::time::timeout(CONNECT_TIMEOUT, connect)
                .await
                .map_err(|_| format!("Rhino did not answer at {host}:{port}"))?
                .map_err(|e| not_reachable(&host, port, &e))?;
            *guard = Some(s);
        }
        let mut attempt = tokio::time::timeout(timeout, Self::exchange_once(guard.as_mut().unwrap(), &request)).await;
        // a connection that sat idle may have been closed by Rhino meanwhile: only then is it safe to retry
        if reused && matches!(&attempt, Ok(Err(e)) if e == "Rhino closed the connection" || e.contains("Broken pipe") || e.contains("reset")) {
            let connect = TcpStream::connect((host.as_str(), port));
            let s = tokio::time::timeout(CONNECT_TIMEOUT, connect)
                .await
                .map_err(|_| format!("Rhino did not answer at {host}:{port}"))?
                .map_err(|e| not_reachable(&host, port, &e))?;
            *guard = Some(s);
            attempt = tokio::time::timeout(timeout, Self::exchange_once(guard.as_mut().unwrap(), &request)).await;
        }
        let reply = match attempt {
            Ok(Ok(v)) => v,
            Ok(Err(e)) => {
                *guard = None;
                return Err(format!("lost the connection to Rhino: {e}"));
            }
            Err(_) => {
                *guard = None;
                return Err(format!(
                    "Rhino did not answer {kind} within {} s. If a dialog or a command prompt is open in Rhino, close it (Esc).",
                    timeout.as_secs()
                ));
            }
        };
        drop(guard);
        if reply["status"] == "error" {
            return Err(reply["message"].as_str().unwrap_or("unknown error from Rhino").to_string());
        }
        let result = reply.get("result").cloned().unwrap_or(Value::Null);
        // several tools report their failure inside the result
        if let Some(e) = result.get("error").and_then(Value::as_str) {
            return Err(e.to_string());
        }
        Ok(result)
    }

    pub async fn fast(&self, kind: &str, params: Value) -> Result<Value, String> {
        self.call(kind, params, FAST).await
    }

    pub async fn slow(&self, kind: &str, params: Value) -> Result<Value, String> {
        self.call(kind, params, SLOW).await
    }

    // ---- status ----

    /// Whether Rhino is there and what it has open. Cached for a few seconds unless `force`.
    pub async fn status(&self, force: bool) -> RhinoStatus {
        if !force
            && let Some((at, s)) = lock(&self.status).as_ref()
            && at.elapsed() < STATUS_TTL
        {
            return s.clone();
        }
        let (host, port) = self.address();
        let mut st = RhinoStatus {
            connected: false,
            host,
            port,
            error: None,
            document: None,
            units: None,
            unit_mm: None,
            objects: None,
        };
        match self.call("get_document_info", json!({ "detail": "inventory", "limit": 1, "include_bbox": false }), Duration::from_secs(5)).await {
            Ok(info) => {
                st.connected = true;
                st.document = info["meta_data"]["name"].as_str().map(str::to_owned);
                st.units = info["meta_data"]["units"].as_str().map(str::to_owned);
                st.unit_mm = st.units.as_deref().and_then(unit_mm);
                st.objects = info["object_count"].as_u64();
            }
            Err(e) => st.error = Some(e),
        }
        *lock(&self.status) = Some((Instant::now(), st.clone()));
        st
    }

    // ---- the design loop ----

    /// Every object of the document: `(id, layer)`.
    async fn inventory(&self) -> Result<Vec<(String, String)>, String> {
        let mut out = Vec::new();
        let mut offset = 0u64;
        loop {
            let page = self
                .fast("get_document_info", json!({ "detail": "inventory", "limit": 1000, "offset": offset, "include_bbox": false }))
                .await?;
            let objs = page["objects"].as_array().cloned().unwrap_or_default();
            for o in &objs {
                if let Some(id) = o["id"].as_str() {
                    out.push((id.to_string(), o["layer"].as_str().unwrap_or("").to_string()));
                }
            }
            if page["objects_truncated"].as_bool() != Some(true) || objs.is_empty() {
                return Ok(out);
            }
            offset += objs.len() as u64;
        }
    }

    /// A fingerprint of the document's objects (ids, names, layers, bounding boxes): it changes when something is
    /// added, removed, moved, resized, renamed or hidden. Shape changes inside an unchanged box are not seen.
    pub async fn signature(&self) -> Result<u64, String> {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        let mut offset = 0u64;
        loop {
            let page = self
                .call(
                    "get_document_info",
                    json!({ "detail": "inventory", "limit": 1000, "offset": offset, "include_bbox": true }),
                    Duration::from_secs(5),
                )
                .await?;
            let objs = page["objects"].as_array().cloned().unwrap_or_default();
            for o in &objs {
                o.to_string().hash(&mut h);
            }
            if page["objects_truncated"].as_bool() != Some(true) || objs.is_empty() {
                return Ok(h.finish());
            }
            offset += objs.len() as u64;
        }
    }

    async fn delete(&self, ids: &[String]) {
        if ids.is_empty() {
            return;
        }
        if self.fast("delete_objects", json!({ "ids": ids, "confirm": true })).await.is_err() {
            // one of them is gone already: the call is all or nothing, so go one by one
            for id in ids {
                let _ = self.fast("delete_objects", json!({ "ids": [id], "confirm": true })).await;
            }
        }
    }

    /// Runs the design script in Rhino, replaces the objects of the previous run by the ones it made, and returns
    /// the geometry of the document (everything visible) as a mesh in millimetres.
    ///
    /// The script is plain RhinoScript (IronPython 2.7) and is sent to the plugin as it is. If it fails the plugin
    /// undoes what it did, so the previous result stays. Its objects are made on the `FC` layer; what a script
    /// makes elsewhere is replaced too, as long as the app has not been restarted since.
    pub async fn run_design(&self, source: &str, tol_mm: f64) -> Result<Design, RunError> {
        let started = Instant::now();
        let status = self.status(true).await;
        if !status.connected {
            return Err(RunError::Other(status.error.unwrap_or_else(|| "Rhino is not reachable".into())));
        }
        let mut warnings = Vec::new();
        let unit = status.unit_mm.unwrap_or(1.0);
        if (unit - 1.0).abs() > 1e-9 {
            warnings.push(format!(
                "the Rhino document is in {}, not millimetres: the model below is converted to millimetres, but the numbers in the script are in {}. Change the document units (Rhino: Options > Units) to Millimeters.",
                status.units.as_deref().unwrap_or("other units"),
                status.units.as_deref().unwrap_or("document units")
            ));
        }

        // the script's objects go on the design layer; the user's current layer is put back afterwards
        let previous = self.fast("get_or_set_current_layer", json!({})).await.ok().and_then(|l| l["name"].as_str().map(str::to_owned));
        let _ = self.fast("create_layer", json!({ "name": DESIGN_LAYER })).await;
        self.fast("get_or_set_current_layer", json!({ "name": DESIGN_LAYER })).await?;

        // The plugin undoes a failed script with `doc.Undo()`, which takes back the *last* undo record: when the
        // script changed nothing before failing, that is the previous command (here, the deletion of the old
        // design). A guard object made right before the script is what such an undo takes back instead.
        let guard = self
            .fast("create_objects", json!({ GUARD: { "type": "POINT", "name": GUARD, "params": { "x": 0, "y": 0, "z": 0 } } }))
            .await
            .ok()
            .and_then(|r| r[GUARD]["id"].as_str().map(str::to_owned));
        let before: Vec<(String, String)> = self.inventory().await?.into_iter().filter(|(i, _)| Some(i) != guard.as_ref()).collect();
        let ran = self.slow("execute_rhinoscript_python_code", json!({ "code": source })).await;
        if let Some(p) = previous.filter(|p| p != DESIGN_LAYER) {
            let _ = self.fast("get_or_set_current_layer", json!({ "name": p })).await;
        }
        // What the script left behind. The plugin undoes a failed script with `doc.Undo()` while its own undo record is
        // still open, so that takes back the guard (the last closed record) and not what the script made before it
        // failed: those partial objects have to be removed here. A script that worked leaves its objects; only the
        // guard goes.
        let all = self.inventory().await?;
        let had: HashSet<&str> = before.iter().map(|(i, _)| i.as_str()).collect();
        let made: Vec<String> = all.iter().filter(|(i, _)| !had.contains(i.as_str())).map(|(i, _)| i.clone()).collect();
        let failed = !matches!(&ran, Ok(r) if r["success"].as_bool() != Some(false));
        let to_remove: Vec<String> = made.iter().filter(|i| failed || Some(*i) == guard.as_ref()).cloned().collect();
        self.delete(&to_remove).await;
        let output = match ran {
            Err(e) => return Err(RunError::Other(e)),
            Ok(r) if r["success"].as_bool() == Some(false) => {
                return Err(RunError::Script(ScriptError { message: script_error(r["message"].as_str().unwrap_or("the script failed")) }));
            }
            Ok(r) => r["result"].as_str().unwrap_or("").to_string(),
        };
        let echoes: Vec<String> = output
            .split_once("Print output:")
            .map_or(output.as_str(), |(_, o)| o.strip_prefix(' ').unwrap_or(o))
            .lines()
            .map(str::trim_end)
            .filter(|l| !l.is_empty())
            .map(str::to_owned)
            .collect();

        // replace the previous result: what the script just made stays, what an earlier run made goes
        let after: Vec<(String, String)> = all.into_iter().filter(|(i, _)| Some(i) != guard.as_ref()).collect();
        let fresh: HashSet<String> = made.into_iter().filter(|i| Some(i) != guard.as_ref()).collect();
        let stale: Vec<String> = {
            let mut d = lock(&self.design);
            let sweep = !d.swept;
            d.swept = true;
            let stale = after
                .iter()
                .filter(|(i, layer)| !fresh.contains(i) && (d.ids.contains(i) || (sweep && layer == DESIGN_LAYER)))
                .map(|(i, _)| i.clone())
                .collect();
            d.ids = fresh;
            stale
        };
        self.delete(&stale).await;

        let mesh = self.fetch_mesh(tol_mm, unit).await?;
        Ok(Design { mesh, echoes, warnings, ms: started.elapsed().as_millis() as u64 })
    }

    /// The visible geometry of the document as one mesh in millimetres, through Rhino's own STL export.
    pub async fn fetch_mesh(&self, tol_mm: f64, unit: f64) -> Result<Mesh, String> {
        std::fs::create_dir_all(&self.exchange).map_err(|e| format!("cannot use {} to get the model from Rhino: {e}", self.exchange.display()))?;
        let n = self.seq.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let file = self.exchange.join(format!("model-{n}.stl"));
        let _ = std::fs::remove_file(&file);
        let selected = self.fast("run_command", json!({ "command": "SelAll" })).await;
        let exported = match selected {
            Ok(_) => self.slow("run_command", json!({ "command": export_command(&file, tol_mm / unit) })).await,
            Err(e) => Err(e),
        };
        let _ = self.fast("run_command", json!({ "command": "SelNone" })).await;
        exported?;
        let bytes = match std::fs::read(&file) {
            Ok(b) => b,
            // nothing to export: an empty document, or only curves and points
            Err(_) => return Ok(Mesh::new()),
        };
        let _ = std::fs::remove_file(&file);
        if bytes.len() <= 84 {
            return Ok(Mesh::new());
        }
        Mesh::from_binary_stl(&bytes, unit, WELD_MM)
    }
}

fn not_reachable(host: &str, port: u16, e: &std::io::Error) -> String {
    format!(
        "cannot reach Rhino at {host}:{port} ({e}). Start Rhino and run `mcpmodstart` (the tectopus plugin), or set the right address in Preferences."
    )
}

/// The first line of the error of a failed script, which is the exception; the rest is a .NET stack trace.
fn script_error(message: &str) -> String {
    let first = message.lines().next().unwrap_or(message);
    let first = first.strip_prefix("Error executing rhinoscript:").unwrap_or(first).trim();
    first
        .replace("Microsoft.Scripting.SyntaxErrorException", "SyntaxError")
        .replace("System.MissingMemberException", "AttributeError")
        .replace("System.", "")
}

/// Rhino's path for `path`: Rhino on Linux is a Windows program under Wine, where the Linux file system is the Z: drive.
pub fn rhino_path(path: &Path) -> String {
    let p = path.to_string_lossy();
    if cfg!(target_os = "linux") {
        format!("Z:{}", p.replace('/', "\\"))
    } else {
        p.into_owned()
    }
}

/// The scripted STL export: binary, every option answered on the command line so that no dialog opens
/// (the two closing `_Enter`s accept the options and the meshing options).
/// `tol` is the largest distance between the mesh and the surface, in document units.
pub fn export_command(file: &Path, tol: f64) -> String {
    format!(
        "-Export \"{}\" _ExportFileAs=_Binary _ExportUnfinishedObjects=_Yes _UseSimpleDialog=_No _UseSimpleParameters=_No _Enter \
         _DetailedOptions _JaggedSeams=_No _PackTextures=_No _Refine=_Yes _SimplePlane=_Yes \
         _AdvancedOptions _Angle=5 _AspectRatio=0 _Distance={tol} _Grid=0 _MaxEdgeLength=0 _MinEdgeLength=0.0001 _Enter _Enter",
        rhino_path(file)
    )
}

#[cfg(test)]
pub mod fake {
    //! A stand-in for the plugin, speaking its protocol, for tests.
    use std::sync::{Arc, Mutex};

    use serde_json::{Value, json};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    /// What the fake was asked, in order.
    pub type Log = Arc<Mutex<Vec<(String, Value)>>>;

    /// Listens on a free port and answers each command with `handler(type, params)` (a `result`, or an
    /// `Err` for `{"status": "error"}`). Returns the port and the log.
    pub async fn serve(handler: impl Fn(&str, &Value) -> Result<Value, String> + Send + Sync + 'static) -> (u16, Log) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let log: Log = Arc::default();
        let handler = Arc::new(handler);
        let seen = log.clone();
        tokio::spawn(async move {
            loop {
                let Ok((mut s, _)) = listener.accept().await else { return };
                let (handler, seen) = (handler.clone(), seen.clone());
                tokio::spawn(async move {
                    let mut buf = Vec::new();
                    let mut chunk = [0u8; 8192];
                    loop {
                        let Ok(n) = s.read(&mut chunk).await else { return };
                        if n == 0 {
                            return;
                        }
                        buf.extend_from_slice(&chunk[..n]);
                        let Ok(req) = serde_json::from_slice::<Value>(&buf) else { continue };
                        buf.clear();
                        let kind = req["type"].as_str().unwrap_or("").to_string();
                        seen.lock().unwrap().push((kind.clone(), req["params"].clone()));
                        let reply = match handler(&kind, &req["params"]) {
                            Ok(r) => json!({ "status": "success", "result": r }),
                            Err(m) => json!({ "status": "error", "message": m }),
                        };
                        if s.write_all(reply.to_string().as_bytes()).await.is_err() {
                            return;
                        }
                    }
                });
            }
        });
        (port, log)
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("fc-rhino-test-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        d
    }

    #[test]
    fn export_command_answers_every_prompt() {
        let c = export_command(Path::new("/home/a/x.stl"), 0.02);
        assert!(c.starts_with("-Export \""), "{c}");
        assert!(c.contains("_ExportFileAs=_Binary") && c.contains("_UseSimpleDialog=_No"), "{c}");
        assert!(c.contains("_Distance=0.02") && c.ends_with("_Enter _Enter"), "{c}");
        if cfg!(target_os = "linux") {
            assert!(c.contains("Z:\\home\\a\\x.stl"), "{c}");
        }
    }

    #[test]
    fn units_in_millimetres() {
        assert_eq!(unit_mm("Millimeters"), Some(1.0));
        assert_eq!(unit_mm("Inches"), Some(25.4));
        assert_eq!(unit_mm("Parsecs"), None);
    }

    #[test]
    fn script_errors_lose_the_stack_trace() {
        let m = "Error executing rhinoscript: System.DivideByZeroException: Attempted to divide by zero.\r\n   at IronPython.Runtime";
        assert_eq!(script_error(m), "DivideByZeroException: Attempted to divide by zero.");
        assert!(script_error("Error executing rhinoscript: Microsoft.Scripting.SyntaxErrorException: unexpected token ':'\r\n at x").starts_with("SyntaxError:"));
    }

    #[tokio::test]
    async fn a_closed_port_is_explained() {
        let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        drop(l);
        let r = Rhino::new("127.0.0.1", port, tmp("closed"));
        let s = r.status(true).await;
        assert!(!s.connected && s.error.unwrap().contains("mcpmodstart"));
    }

    #[tokio::test]
    async fn status_reads_the_document() {
        let (port, log) = fake::serve(|kind, _| match kind {
            "get_document_info" => Ok(json!({ "meta_data": { "name": "ring.3dm", "units": "Inches" }, "object_count": 3 })),
            _ => Err("no".into()),
        })
        .await;
        let r = Rhino::new("127.0.0.1", port, tmp("status"));
        let s = r.status(false).await;
        assert!(s.connected, "{s:?}");
        assert_eq!((s.document.as_deref(), s.units.as_deref(), s.unit_mm, s.objects), (Some("ring.3dm"), Some("Inches"), Some(25.4), Some(3)));
        // a second look within the TTL does not ask Rhino again
        r.status(false).await;
        assert_eq!(log.lock().unwrap().len(), 1);
        r.status(true).await;
        assert_eq!(log.lock().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn errors_inside_a_result_and_in_the_envelope_are_both_errors() {
        let (port, _) = fake::serve(|kind, _| match kind {
            "a" => Err("boom".into()),
            _ => Ok(json!({ "error": "No active view" })),
        })
        .await;
        let r = Rhino::new("127.0.0.1", port, tmp("err"));
        assert_eq!(r.fast("a", json!({})).await.unwrap_err(), "boom");
        assert_eq!(r.fast("b", json!({})).await.unwrap_err(), "No active view");
    }

    #[tokio::test]
    async fn a_big_reply_arrives_whole() {
        let big = "x".repeat(3_000_000);
        let b2 = big.clone();
        let (port, _) = fake::serve(move |_, _| Ok(json!({ "text": b2 }))).await;
        let r = Rhino::new("127.0.0.1", port, tmp("big"));
        assert_eq!(r.fast("t", json!({})).await.unwrap()["text"].as_str().unwrap().len(), big.len());
    }

    /// The design loop against a fake plugin: the first run sweeps the design layer, later runs replace the
    /// previous run's objects, a failing script leaves them alone, and the STL written by "Rhino" is read back.
    #[tokio::test]
    async fn the_design_loop() {
        let dir = tmp("loop");
        let exchange = dir.clone();
        let objects: Arc<Mutex<Vec<(String, String)>>> = Arc::new(Mutex::new(vec![("old".into(), "FC".into()), ("mine".into(), "Default".into())]));
        let obj = objects.clone();
        let next = Arc::new(Mutex::new(0u32));
        let cube = crate::mesh::tests::cube(0.0, 2.0);
        let stl = cube.to_binary_stl();
        let (port, log) = fake::serve(move |kind, p| match kind {
            "get_document_info" => {
                let o = obj.lock().unwrap();
                let list: Vec<Value> = o.iter().map(|(i, l)| json!({ "id": i, "layer": l })).collect();
                Ok(json!({ "meta_data": { "name": null, "units": "Millimeters" }, "object_count": o.len(), "objects": list, "objects_truncated": false }))
            }
            "get_or_set_current_layer" => Ok(json!({ "name": "Default" })),
            "create_layer" => Ok(json!({ "name": "FC" })),
            "create_objects" => {
                obj.lock().unwrap().push(("guard".into(), "FC".into()));
                Ok(json!({ "__fc_guard": { "id": "guard" } }))
            }
            "execute_rhinoscript_python_code" => {
                let code = p["code"].as_str().unwrap();
                if code.contains("boom") {
                    return Ok(json!({ "success": false, "message": "Error executing rhinoscript: System.ZeroDivisionError: boom\r\n   at x" }));
                }
                let mut n = next.lock().unwrap();
                *n += 1;
                obj.lock().unwrap().push((format!("new{n}"), "FC".into()));
                Ok(json!({ "success": true, "result": "Script successfully executed! Print output: hello\n" }))
            }
            "delete_objects" => {
                let ids: Vec<String> = p["ids"].as_array().unwrap().iter().map(|i| i.as_str().unwrap().to_string()).collect();
                obj.lock().unwrap().retain(|(i, _)| !ids.contains(i));
                Ok(json!({ "count": ids.len() }))
            }
            "run_command" => {
                let c = p["command"].as_str().unwrap();
                if c.starts_with("-Export") {
                    let path = c.split('"').nth(1).unwrap();
                    let path = path.strip_prefix("Z:").map_or(path.to_string(), |p| p.replace('\\', "/"));
                    std::fs::write(path, &stl).unwrap();
                }
                Ok(json!({ "success": true }))
            }
            _ => Err(format!("unexpected {kind}")),
        })
        .await;
        let r = Rhino::new("127.0.0.1", port, exchange);

        let d = r.run_design("make()", 0.02).await.ok().expect("first run");
        assert_eq!(d.echoes, vec!["hello"]);
        assert!((d.mesh.volume() - 8.0).abs() < 1e-6);
        // the earlier session's leftovers on the design layer went, the user's own object stayed
        let ids: Vec<String> = objects.lock().unwrap().iter().map(|(i, _)| i.clone()).collect();
        assert_eq!(ids, vec!["mine", "new1"]);

        r.run_design("make()", 0.02).await.ok().expect("second run");
        let ids: Vec<String> = objects.lock().unwrap().iter().map(|(i, _)| i.clone()).collect();
        assert_eq!(ids, vec!["mine", "new2"], "the previous run's object is replaced");

        match r.run_design("boom", 0.02).await {
            Err(RunError::Script(e)) => assert_eq!(e.message, "ZeroDivisionError: boom"),
            _ => panic!("expected the script's error"),
        }
        let ids: Vec<String> = objects.lock().unwrap().iter().map(|(i, _)| i.clone()).collect();
        assert_eq!(ids, vec!["mine", "new2"], "a failed run changes nothing");
        // the selection is cleared again, and the temp file is gone
        assert!(log.lock().unwrap().iter().any(|(k, p)| k == "run_command" && p["command"] == "SelNone"));
        assert!(std::fs::read_dir(&dir).map_or(true, |mut d| d.next().is_none()));
    }
}
