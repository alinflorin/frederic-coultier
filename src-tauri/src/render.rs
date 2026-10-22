//! OpenSCAD source -> mesh, using the embedded openrscad engine.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use openrscad_eval::{eval_program_with_budget, register_system_fonts};
use crate::scadlib::LibResolver;
use crate::shade;
use openrscad_geom::{GeomCache, Mesh, render_cached_warns};
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
pub struct RenderCache(Arc<Mutex<CachedMesh>>);

/// The source hash and the mesh it produced.
type CachedMesh = Option<(u64, Arc<Mesh>)>;

fn hash(source: &str) -> u64 {
    let mut h = DefaultHasher::new();
    source.hash(&mut h);
    h.finish()
}

/// 1-based line and column of a byte offset.
pub(crate) fn line_col(source: &str, offset: usize) -> (usize, usize) {
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
    RenderFailure {
        message,
        line,
        column,
    }
}

fn render_now(source: &str) -> Result<Rendered, RenderFailure> {
    let started = Instant::now();
    if source.contains("text(") {
        register_system_fonts();
    }

    let program =
        openrscad_syntax::parse(source).map_err(|e| failure(source, e.message, Some(e.span)))?;
    // No file system access: include/use only reach the libraries bundled with the app.
    let out = eval_program_with_budget(&program, &LibResolver, ".", EVAL_BUDGET)
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
            Diagnostic {
                severity: "warning",
                message: w.message.clone(),
                line,
                column,
            }
        })
        .collect();

    let mut cache = GeomCache::new();
    let (mesh, geom_warnings) = render_cached_warns(&out.node, &Kernel::new(), &mut cache)
        .map_err(|e| RenderFailure {
            message: e.to_string(),
            line: None,
            column: None,
        })?;
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
/// becomes an error instead of taking the app down. Nothing is cached.
pub fn render_plain(source: String) -> Result<Rendered, RenderFailure> {
    let handle = std::thread::Builder::new()
        .stack_size(STACK_BYTES)
        .spawn(move || render_now(&source))
        .map_err(|e| RenderFailure {
            message: e.to_string(),
            line: None,
            column: None,
        })?;
    handle.join().unwrap_or_else(|_| {
        Err(RenderFailure {
            message: "the renderer crashed on this model".into(),
            line: None,
            column: None,
        })
    })
}

/// [`render_plain`], remembering the mesh so an export right after doesn't evaluate twice.
pub fn render_on_big_stack(source: String, cache: &RenderCache) -> Result<Rendered, RenderFailure> {
    let key = hash(&source);
    let rendered = render_plain(source)?;
    *cache.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some((key, rendered.mesh.clone()));
    Ok(rendered)
}

/// The mesh for `source`, from the cache if it is the model last rendered.
pub fn mesh_for(source: &str, cache: &RenderCache) -> Result<Arc<Mesh>, RenderFailure> {
    if let Some((key, mesh)) = cache.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner).as_ref()
        && *key == hash(source) {
            return Ok(mesh.clone());
        }
    render_on_big_stack(source.to_owned(), cache).map(|r| r.mesh)
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

    const RING: &str = include_str!("../../src/sample.scad");

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
        let spec = hollow::HollowSpec {
            wall: 0.8,
            drain: 1.0,
            tilt: 30.0,
        };
        let hollowed = hollow::hollow(&r.mesh, &spec).expect("hollow ok");
        eprintln!(
            "hollow: {:?} in {:?}",
            hollowed.as_ref().map(|h| &h.1),
            t.elapsed()
        );
        let base = hollowed.map_or((*r.mesh).clone(), |h| h.0);
        assert!(base.volume() <= r.mesh.volume());
        let (_, rep) = meshtools::simplify(
            &base,
            &meshtools::SimplifySpec {
                keep_percent: 60.0,
                max_volume_change: 1.0,
            },
        );
        eprintln!("simplify: {rep:?}");
        let p = supports::PrintParams {
            tilt: 30.0,
            lift: 3.0,
            tip: 0.2,
            base: 0.8,
            raft: 1.0,
            raft_radius: 3.0,
        };
        let auto = supports::AutoParams {
            angle: 45.0,
            spacing: 4.0,
            step: 1.0,
            bias: 3.0,
        };
        let sup = supports::auto_supports(&base, &p, &auto, &[], 1).unwrap();
        let baked = supports::bake(&base, &sup.supports, &p).unwrap();
        eprintln!(
            "supports {} baked tris {} total {:?}",
            sup.supports.len(),
            baked.tris.len(),
            t.elapsed()
        );
        assert!(baked.tris.len() > base.tris.len());
    }

    #[test]
    fn sprue_on_the_sample_ring() {
        let r = render_on_big_stack(RING.into(), &RenderCache::default()).unwrap();
        let spec = crate::meshtools::SprueSpec {
            diameter: 2.0,
            length: 5.0,
            at: None,
        };
        let t = std::time::Instant::now();
        let got = crate::meshtools::plan_sprue(&r.mesh, &spec);
        eprintln!(
            "sprue: {:?} in {:?}",
            got.as_ref().map(|g| (g.0.tris.len(), g.1, g.0.bbox())),
            t.elapsed()
        );
        assert!(got.is_some());
    }

    #[test]
    fn bundled_bosl2_renders() {
        let src = "include <BOSL2/std.scad>\n\
                   cuboid([10,8,4], rounding=1, $fn=24);";
        let r = render_on_big_stack(src.into(), &RenderCache::default()).expect("render");
        let (min, max) = r.mesh.bbox().expect("non-empty");
        assert!((max[0] - min[0] - 10.0).abs() < 1e-6, "{min:?} {max:?}");
        assert!(r.mesh.volume() > 250.0 && r.mesh.volume() < 320.0, "volume {}", r.mesh.volume());
        assert!(r.diagnostics.is_empty(), "{:?}", r.diagnostics);
        eprintln!("BOSL2 cuboid: {} ms", r.ms);
    }

    #[test]
    fn bundled_bosl2_nurbs_and_sweep() {
        // A ring shank: a closed NURBS path swept with a rounded rectangle profile.
        let src = "include <BOSL2/std.scad>\n\
                   include <BOSL2/nurbs.scad>\n\
                   ctrl = [for (a = [0:45:315]) [9*cos(a), 0, 9*sin(a) * (a == 90 ? 1.15 : 1)]];\n\
                   path = nurbs_curve(ctrl, 3, splinesteps=16, type=\"closed\");\n\
                   path_sweep(rect([2.4,1.6], rounding=0.5, $fn=16), path, closed=true);";
        let r = render_on_big_stack(src.into(), &RenderCache::default()).expect("render");
        assert!(r.mesh.volume() > 100.0, "volume {}", r.mesh.volume());
        assert!(r.diagnostics.is_empty(), "{:?}", r.diagnostics);
        eprintln!("BOSL2 nurbs sweep: {} ms", r.ms);
    }

    #[test]
    fn missing_library_is_a_warning() {
        let r = render_on_big_stack("use <nope.scad>\ncube(1);".into(), &RenderCache::default()).unwrap();
        assert!(r.diagnostics.iter().any(|d| d.message.contains("nope.scad")));
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
