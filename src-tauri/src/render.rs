//! OpenSCAD source -> mesh, using the embedded openrscad engine.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use openrscad_eval::{eval_program_with_budget, register_system_fonts, NullResolver};
use openrscad_geom::{render_cached_warns, GeomCache, Mesh};
use serde::Serialize;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub use openrscad_geom::ManifoldKernel as Kernel;
#[cfg(any(target_os = "android", target_os = "ios"))]
pub use openrscad_geom::RustManifoldKernel as Kernel;

/// Evaluation fuel. Stops runaway scripts (an unbounded `for`, deep
/// recursion) instead of hanging the app; generous for real jewelry models.
const EVAL_BUDGET: u64 = 200_000_000;
/// Recursive libraries nest the evaluator deeply, hence a big stack.
const STACK_BYTES: usize = 256 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
pub struct Diagnostic {
    pub severity: &'static str, // "error" | "warning"
    pub message: String,
    pub line: Option<usize>,
    pub column: Option<usize>,
}

/// A render that produced no geometry because of an error in the source.
#[derive(Debug, Clone, Serialize)]
pub struct RenderFailure {
    pub message: String,
    pub line: Option<usize>,
    pub column: Option<usize>,
}

pub struct Rendered {
    pub mesh: Arc<Mesh>,
    pub echoes: Vec<String>,
    pub diagnostics: Vec<Diagnostic>,
    pub ms: u64,
}

/// Last rendered mesh, so exporting right after previewing doesn't evaluate twice.
#[derive(Default, Clone)]
pub struct RenderCache(Arc<Mutex<Option<(u64, Arc<Mesh>)>>>);

fn hash(source: &str) -> u64 {
    let mut h = DefaultHasher::new();
    source.hash(&mut h);
    h.finish()
}

/// 1-based line and column of a byte offset.
fn line_col(source: &str, offset: usize) -> (usize, usize) {
    let offset = offset.min(source.len());
    let before = source.get(..offset).unwrap_or_else(|| {
        // offset fell inside a multi-byte character; back up to a boundary
        let mut o = offset;
        while !source.is_char_boundary(o) {
            o -= 1;
        }
        &source[..o]
    });
    let line = before.matches('\n').count() + 1;
    let col = before.rsplit('\n').next().map_or(0, |l| l.chars().count()) + 1;
    (line, col)
}

fn failure(source: &str, message: String, span: Option<std::ops::Range<usize>>) -> RenderFailure {
    let (line, column) = match span {
        Some(r) => {
            let (l, c) = line_col(source, r.start);
            (Some(l), Some(c))
        }
        None => (None, None),
    };
    RenderFailure { message, line, column }
}

fn render_now(source: &str) -> Result<Rendered, RenderFailure> {
    let started = Instant::now();
    if source.contains("text(") {
        register_system_fonts();
    }

    let program = openrscad_syntax::parse(source)
        .map_err(|e| failure(source, e.message, Some(e.span)))?;
    // Projects are self-contained: no file system access for include/use/import.
    let out = eval_program_with_budget(&program, &NullResolver, ".", EVAL_BUDGET)
        .map_err(|e| failure(source, e.message, e.span))?;

    let mut diagnostics: Vec<Diagnostic> = out
        .warnings
        .iter()
        .map(|w| {
            let (line, column) = match &w.span {
                Some(r) => {
                    let (l, c) = line_col(source, r.start);
                    (Some(l), Some(c))
                }
                None => (None, None),
            };
            Diagnostic { severity: "warning", message: w.message.clone(), line, column }
        })
        .collect();

    let mut cache = GeomCache::new();
    let (mesh, geom_warnings) = render_cached_warns(&out.node, &Kernel::new(), &mut cache)
        .map_err(|e| RenderFailure { message: e.to_string(), line: None, column: None })?;
    diagnostics.extend(geom_warnings.into_iter().map(|message| Diagnostic {
        severity: "warning",
        message,
        line: None,
        column: None,
    }));

    Ok(Rendered {
        mesh: Arc::new(mesh),
        echoes: out.echoes,
        diagnostics,
        ms: started.elapsed().as_millis() as u64,
    })
}

/// Runs the render on a thread with a large stack; a panic in the engine
/// becomes an error instead of taking the app down.
pub fn render_on_big_stack(source: String, cache: &RenderCache) -> Result<Rendered, RenderFailure> {
    let key = hash(&source);
    let handle = std::thread::Builder::new()
        .stack_size(STACK_BYTES)
        .spawn(move || render_now(&source))
        .map_err(|e| RenderFailure { message: e.to_string(), line: None, column: None })?;
    let rendered = handle.join().unwrap_or_else(|_| {
        Err(RenderFailure {
            message: "the renderer crashed on this model".into(),
            line: None,
            column: None,
        })
    })?;
    *cache.0.lock().unwrap() = Some((key, rendered.mesh.clone()));
    Ok(rendered)
}

/// The mesh for `source`, from the cache if it is the model last rendered.
pub fn mesh_for(source: &str, cache: &RenderCache) -> Result<Arc<Mesh>, RenderFailure> {
    if let Some((key, mesh)) = cache.0.lock().unwrap().as_ref() {
        if *key == hash(source) {
            return Ok(mesh.clone());
        }
    }
    render_on_big_stack(source.to_owned(), cache).map(|r| r.mesh)
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

    const RING: &str = include_str!("../../src/sample.scad");

    #[test]
    fn renders_the_sample_ring() {
        let r = render_on_big_stack(RING.into(), &RenderCache::default()).expect("render");
        let (min, max) = r.mesh.bbox().expect("non-empty");
        let size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
        // 17.3 mm inner diameter + 2 * 1.6 band, 2.4 wide band, stone on top
        assert!((size[0] - 20.5).abs() < 0.3, "x {size:?}");
        assert!(size[1] > 2.0 && size[1] < 6.0, "y {size:?}");
        assert!(size[2] > 20.0, "z {size:?}");
        assert!(r.mesh.volume() > 50.0);
        assert!(r.mesh.to_binary_stl().len() > 84);
    }

    #[test]
    fn sample_ring_survives_the_whole_pipeline() {
        use crate::{hollow, meshtools, supports};
        let r = render_on_big_stack(RING.into(), &RenderCache::default()).unwrap();
        let t = std::time::Instant::now();
        let spec = hollow::HollowSpec { wall: 0.8, drain: 1.0, tilt: 30.0 };
        let hollowed = hollow::hollow(&r.mesh, &spec).expect("hollow ok");
        eprintln!("hollow: {:?} in {:?}", hollowed.as_ref().map(|h| &h.1), t.elapsed());
        let base = hollowed.map_or((*r.mesh).clone(), |h| h.0);
        assert!(base.volume() <= r.mesh.volume());
        let (_, rep) = meshtools::simplify(&base, &meshtools::SimplifySpec { keep_percent: 60.0, max_volume_change: 1.0 });
        eprintln!("simplify: {rep:?}");
        let p = supports::PrintParams { tilt: 30.0, lift: 3.0, tip: 0.2, base: 0.8, raft: 1.0, raft_radius: 3.0 };
        let auto = supports::AutoParams { angle: 45.0, spacing: 4.0, step: 1.0, bias: 3.0 };
        let sup = supports::auto_supports(&base, &p, &auto, &[], 1).unwrap();
        let baked = supports::bake(&base, &sup.supports, &p).unwrap();
        eprintln!("supports {} baked tris {} total {:?}", sup.supports.len(), baked.tris.len(), t.elapsed());
        assert!(baked.tris.len() > base.tris.len());
    }

    #[test]
    fn sprue_on_the_sample_ring() {
        let r = render_on_big_stack(RING.into(), &RenderCache::default()).unwrap();
        let spec = crate::meshtools::SprueSpec { diameter: 2.0, length: 5.0, at: None };
        let t = std::time::Instant::now();
        let got = crate::meshtools::plan_sprue(&r.mesh, &spec);
        eprintln!("sprue: {:?} in {:?}", got.as_ref().map(|g| (g.0.tris.len(), g.1, g.0.bbox())), t.elapsed());
        assert!(got.is_some());
    }

    #[test]
    fn syntax_error_has_position() {
        let e = render_on_big_stack("cube(1);\ncube(;".into(), &RenderCache::default())
            .err()
            .expect("should fail");
        assert_eq!(e.line, Some(2), "{e:?}");
    }

    #[test]
    fn empty_model_renders_empty() {
        let r = render_on_big_stack("$fn = 64;".into(), &RenderCache::default()).unwrap();
        assert!(r.mesh.is_empty());
    }

    #[test]
    fn runaway_script_is_stopped() {
        let src = "for (i = [0 : 1e12]) translate([i, 0, 0]) cube(0.1);";
        assert!(render_on_big_stack(src.into(), &RenderCache::default()).is_err());
    }

    #[test]
    fn export_formats_encode() {
        let r = render_on_big_stack("cube(2);".into(), &RenderCache::default()).unwrap();
        for f in ["stl-bin", "stl-ascii", "obj", "3mf"] {
            assert!(!encode(f, &r.mesh, "t").unwrap().is_empty(), "{f}");
        }
        assert!(encode("nope", &r.mesh, "t").is_none());
        assert!((r.mesh.volume() - 8.0).abs() < 1e-6);
    }

    #[test]
    fn line_col_handles_unicode() {
        assert_eq!(line_col("é\nab", 4), (2, 2));
    }
}
