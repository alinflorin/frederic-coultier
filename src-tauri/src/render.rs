//! Design script -> mesh, through Rhino: the script runs there (see `rhino`) and the geometry comes back as an STL.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex};

use serde::Serialize;

use crate::mesh::Mesh;
use crate::rhino::{Rhino, RunError};
use crate::shade;

/// Chordal tolerance (mm) when nothing says otherwise.
pub const DEFAULT_TOLERANCE: f64 = 0.02;

#[derive(Debug, Clone, Serialize)]
pub struct Diagnostic {
    pub severity: &'static str, // "error" | "warning"
    pub message: String,
    pub line: Option<usize>,
    pub column: Option<usize>,
}

/// A render that produced no geometry: the script failed, or Rhino could not be reached.
#[derive(Debug, Clone, Serialize)]
pub struct RenderFailure {
    pub message: String,
    pub line: Option<usize>,
    pub column: Option<usize>,
}

impl RenderFailure {
    pub fn new(message: impl Into<String>) -> Self {
        Self { message: message.into(), line: None, column: None }
    }
}

pub struct Rendered {
    pub mesh: Arc<Mesh>,
    pub echoes: Vec<String>,
    pub diagnostics: Vec<Diagnostic>,
    pub ms: u64,
}

/// The source and tolerance (hashed) and the mesh they produced.
type CachedMesh = Option<(u64, Arc<Mesh>)>;

fn hash(source: &str) -> u64 {
    let mut h = DefaultHasher::new();
    source.hash(&mut h);
    h.finish()
}

/// Renders through Rhino and remembers the last mesh, so that checking or exporting right after previewing does
/// not run the script a second time.
#[derive(Clone)]
pub struct Engine {
    pub rhino: Arc<Rhino>,
    cache: Arc<Mutex<CachedMesh>>,
    tol: Arc<Mutex<f64>>,
    /// The fingerprint of the Rhino document when the preview was last made (see `changed`).
    seen: Arc<Mutex<Option<u64>>>,
}

impl Engine {
    pub fn new(rhino: Arc<Rhino>) -> Self {
        Self { rhino, cache: Arc::default(), tol: Arc::new(Mutex::new(DEFAULT_TOLERANCE)), seen: Arc::default() }
    }

    fn tolerance(&self) -> f64 {
        *self.tol.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    async fn remember(&self) {
        let sig = self.rhino.signature().await.ok();
        *self.seen.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = sig;
    }

    /// Whether the document in Rhino is different from what the preview shows (the user worked in Rhino).
    pub async fn changed(&self) -> bool {
        let Some(seen) = *self.seen.lock().unwrap_or_else(std::sync::PoisonError::into_inner) else {
            return false;
        };
        self.rhino.signature().await.is_ok_and(|now| now != seen)
    }

    /// Runs the script in Rhino and returns what it made. Always runs: the document may have changed since.
    pub async fn render(&self, source: &str, tol: Option<f64>) -> Result<Rendered, RenderFailure> {
        let tol = tol.unwrap_or_else(|| self.tolerance()).clamp(0.001, 1.0);
        *self.tol.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = tol;
        let key = hash(source);
        match self.rhino.run_design(source, tol).await {
            Ok(d) => {
                let mesh = Arc::new(d.mesh);
                *self.cache.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some((key, mesh.clone()));
                self.remember().await;
                Ok(Rendered {
                    mesh,
                    echoes: d.echoes,
                    diagnostics: d
                        .warnings
                        .into_iter()
                        .map(|message| Diagnostic { severity: "warning", message, line: None, column: None })
                        .collect(),
                    ms: d.ms,
                })
            }
            Err(RunError::Script(e)) => Err(RenderFailure::new(e.message)),
            Err(RunError::Other(m)) => Err(RenderFailure::new(m)),
        }
    }

    /// The model as it is in Rhino now, without running the script again: after a command or the user changed the
    /// document directly.
    pub async fn refresh(&self, source: &str) -> Result<Rendered, RenderFailure> {
        let started = std::time::Instant::now();
        let status = self.rhino.status(true).await;
        if !status.connected {
            return Err(RenderFailure::new(status.error.unwrap_or_else(|| "Rhino is not reachable".into())));
        }
        let mesh = self.rhino.fetch_mesh(self.tolerance(), status.unit_mm.unwrap_or(1.0)).await.map_err(RenderFailure::new)?;
        let mesh = Arc::new(mesh);
        *self.cache.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some((hash(source), mesh.clone()));
        self.remember().await;
        Ok(Rendered { mesh, echoes: Vec::new(), diagnostics: Vec::new(), ms: started.elapsed().as_millis() as u64 })
    }

    /// The mesh for `source`: the one rendered last if that was this source, else render it now.
    pub async fn mesh_for(&self, source: &str) -> Result<Arc<Mesh>, RenderFailure> {
        if let Some((key, mesh)) = self.cache.lock().unwrap_or_else(std::sync::PoisonError::into_inner).as_ref()
            && *key == hash(source)
        {
            return Ok(mesh.clone());
        }
        self.render(source, None).await.map(|r| r.mesh)
    }
}

/// Preview payload of a model: smooth normals and feature edges precomputed (see `shade`).
pub fn encode_model(mesh: &Mesh) -> Vec<u8> {
    shade::encode(
        mesh,
        &shade::Shading::Creased { crease: 35f64.to_radians(), edge_angle: 28f64.to_radians() },
    )
}

/// Preview payload of supports and sprue, which are drawn faceted.
pub fn encode_flat(mesh: &Mesh) -> Vec<u8> {
    shade::encode(mesh, &shade::Shading::Flat)
}

pub fn encode(format: &str, mesh: &Mesh, name: &str) -> Option<Vec<u8>> {
    match format {
        "stl-bin" => Some(mesh.to_binary_stl()),
        "stl-ascii" => Some(mesh.to_ascii_stl(name).into_bytes()),
        "obj" => Some(mesh.to_obj().into_bytes()),
        "3mf" => Some(mesh.to_3mf()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_encoding_has_the_documented_layout() {
        let mesh = Mesh {
            verts: vec![[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [0.0, 2.0, 0.0]],
            tris: vec![[0, 1, 2]],
        };
        let b = encode_model(&mesh);
        let u = |at: usize| u32::from_le_bytes(b[at..at + 4].try_into().unwrap());
        assert_eq!((u(0), u(4), u(8), u(12)), (3, 1, 1, 6)); // one open triangle: 3 boundary edges
        assert_eq!(b.len(), shade::HEADER + 3 * 12 + 3 * 12 + 12 + 6 * 12);
        assert_eq!(f32::from_le_bytes(b[shade::HEADER + 28..shade::HEADER + 32].try_into().unwrap()), 2.0);
        let flat = encode_flat(&mesh);
        assert_eq!(flat.len(), shade::HEADER + 3 * 12 * 2);
    }

    #[test]
    fn export_formats_encode() {
        let m = crate::mesh::tests::cube(0.0, 2.0);
        for f in ["stl-bin", "stl-ascii", "obj", "3mf"] {
            assert!(!encode(f, &m, "t").unwrap().is_empty(), "{f}");
        }
        assert!(encode("nope", &m, "t").is_none());
    }

    /// Against a Rhino that is running with the plugin: `cargo test live_rhino -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore]
    async fn live_rhino() {
        let home = std::env::var("HOME").unwrap();
        let dir = std::path::PathBuf::from(home).join(".cache/fc-live-exchange");
        let _ = std::fs::remove_dir_all(&dir);
        let e = Engine::new(Arc::new(Rhino::new("127.0.0.1", 1999, dir)));
        let src = include_str!("../../src/sample.py");
        let t = std::time::Instant::now();
        let r = e.render(src, Some(0.02)).await.map_err(|f| f.message).expect("render");
        let (lo, hi) = r.mesh.bbox().expect("geometry");
        eprintln!("{} tris, {} verts, volume {:.1} mm3, bbox {lo:?} {hi:?}, {:?}, echoes {:?}, warnings {:?}", r.mesh.tris.len(), r.mesh.verts.len(), r.mesh.volume(), t.elapsed(), r.echoes, r.diagnostics);
        let again = e.render(src, Some(0.02)).await.map_err(|f| f.message).expect("second render");
        assert_eq!(again.mesh.tris.len(), r.mesh.tris.len(), "the second run replaces the first, it does not add to it");
        let bad = e.render("x = 1/0", None).await.err().expect("fails");
        eprintln!("error: {}", bad.message);
        // a script that makes something and then fails must leave nothing behind
        let partial = "import rhinoscriptsyntax as rs\nrs.AddSphere((0, 0, 30), 3)\nx = 1/0";
        assert!(e.render(partial, None).await.is_err());
        assert_eq!(e.refresh(src).await.map_err(|f| f.message).expect("refresh").mesh.tris.len(), r.mesh.tris.len(), "the half-made sphere is gone");
        let still = e.render(src, None).await.map_err(|f| f.message).expect("third render");
        assert_eq!(still.mesh.tris.len(), r.mesh.tris.len());
        let st = e.rhino.status(true).await;
        eprintln!("{st:?}");
    }

    #[tokio::test]
    async fn a_change_made_in_rhino_is_noticed() {
        use serde_json::json;
        let objects = Arc::new(Mutex::new(vec![json!({ "id": "a", "bbox": [[0, 0, 0], [1, 1, 1]] })]));
        let o = objects.clone();
        let (port, _) = crate::rhino::fake::serve(move |kind, _| match kind {
            "get_document_info" => Ok(json!({ "meta_data": { "units": "Millimeters" }, "objects": *o.lock().unwrap(), "objects_truncated": false })),
            _ => Ok(json!({ "success": true, "result": "" })),
        })
        .await;
        let dir = std::env::temp_dir().join(format!("fc-changed-test-{}", std::process::id()));
        let e = Engine::new(Arc::new(Rhino::new("127.0.0.1", port, dir)));
        assert!(!e.changed().await, "nothing to compare with before the first render");
        e.refresh("s").await.ok();
        assert!(!e.changed().await, "the preview shows what is there");
        objects.lock().unwrap()[0] = json!({ "id": "a", "bbox": [[0, 0, 0], [2, 1, 1]] });
        assert!(e.changed().await, "an object was resized in Rhino");
        e.refresh("s").await.ok();
        assert!(!e.changed().await, "refreshing takes the new state as the shown one");
    }

    #[tokio::test]
    async fn the_cache_serves_the_mesh_of_the_last_render() {
        use serde_json::json;
        let stl = crate::mesh::tests::cube(0.0, 2.0).to_binary_stl();
        let dir = std::env::temp_dir().join(format!("fc-render-test-{}", std::process::id()));
        let calls = Arc::new(Mutex::new(0u32));
        let c = calls.clone();
        let d2 = dir.clone();
        let (port, _) = crate::rhino::fake::serve(move |kind, p| match kind {
            "get_document_info" => Ok(json!({ "meta_data": { "units": "Millimeters" }, "objects": [], "objects_truncated": false })),
            "get_or_set_current_layer" => Ok(json!({ "name": "Default" })),
            "create_layer" => Ok(json!({})),
            "create_objects" => Ok(json!({ "__fc_guard": { "id": "g" } })),
            "execute_rhinoscript_python_code" => {
                *c.lock().unwrap() += 1;
                Ok(json!({ "success": true, "result": "ok" }))
            }
            "run_command" => {
                let cmd = p["command"].as_str().unwrap();
                if cmd.starts_with("-Export") {
                    let path = cmd.split('"').nth(1).unwrap();
                    let path = path.strip_prefix("Z:").map_or(path.to_string(), |p| p.replace('\\', "/"));
                    std::fs::write(path, &stl).unwrap();
                }
                Ok(json!({ "success": true }))
            }
            _ => Ok(json!({})),
        })
        .await;
        let _ = d2;
        let e = Engine::new(Arc::new(Rhino::new("127.0.0.1", port, dir)));
        let r = e.render("a", Some(0.05)).await.ok().unwrap();
        assert!((r.mesh.volume() - 8.0).abs() < 1e-6);
        assert!(e.mesh_for("a").await.is_ok());
        assert_eq!(*calls.lock().unwrap(), 1, "the cache answers for the same source");
        e.mesh_for("b").await.ok().unwrap();
        assert_eq!(*calls.lock().unwrap(), 2);
        assert!((e.tolerance() - 0.05).abs() < 1e-12, "{}", e.tolerance());
    }
}
