//! Gems. The engine knows nothing about colour, so a design marks its stones with a module:
//! `module gem() { children(); }`, and wraps every stone in `gem() { ... }`. The piece is rendered
//! twice, once as it is and once with `gem()` emptied; a triangle of the full mesh that lies on the
//! surface of the metal-only mesh is metal, the rest is stone. That gives the preview its glass
//! and the weight estimate its metal volume, without touching the geometry that is exported.

use std::sync::OnceLock;

use openrscad_geom::Mesh;
use regex::Regex;

use crate::bvh::{Bvh, V3};
use crate::render;

/// Distance (mm) under which a triangle counts as lying on the metal's surface.
const ON_SURFACE: f64 = 2e-3;

fn definition() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"module\s+gem\s*\(\s*\)\s*\{").expect("valid regex"))
}

/// The source with the stones taken out, or `None` when the design has no `gem()` module.
pub fn metal_source(source: &str) -> Option<String> {
    definition()
        .is_match(source)
        .then(|| definition().replace(source, "module gem() {} module gem__stones() {").into_owned())
}

pub struct Split {
    /// The metal-only mesh.
    pub metal: Mesh,
    /// The full mesh with its stone triangles moved to the end.
    pub full: Mesh,
    /// How many triangles at the end of `full` are stone.
    pub gem_tris: usize,
}

fn sub(a: V3, b: V3) -> V3 {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn dot(a: V3, b: V3) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/// Distance from `p` to the triangle `abc` (Ericson, Real-Time Collision Detection).
fn point_tri(p: V3, a: V3, b: V3, c: V3) -> f64 {
    let (ab, ac, ap) = (sub(b, a), sub(c, a), sub(p, a));
    let (d1, d2) = (dot(ab, ap), dot(ac, ap));
    let at = |q: V3| dot(sub(p, q), sub(p, q)).sqrt();
    if d1 <= 0.0 && d2 <= 0.0 {
        return at(a);
    }
    let bp = sub(p, b);
    let (d3, d4) = (dot(ab, bp), dot(ac, bp));
    if d3 >= 0.0 && d4 <= d3 {
        return at(b);
    }
    let vc = d1 * d4 - d3 * d2;
    let along = |o: V3, e: V3, t: f64| at([o[0] + e[0] * t, o[1] + e[1] * t, o[2] + e[2] * t]);
    if vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0 {
        return along(a, ab, d1 / (d1 - d3));
    }
    let cp = sub(p, c);
    let (d5, d6) = (dot(ab, cp), dot(ac, cp));
    if d6 >= 0.0 && d5 <= d6 {
        return at(c);
    }
    let vb = d5 * d2 - d1 * d6;
    if vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0 {
        return along(a, ac, d2 / (d2 - d6));
    }
    let va = d3 * d6 - d5 * d4;
    if va <= 0.0 && d4 - d3 >= 0.0 && d5 - d6 >= 0.0 {
        let bc = sub(c, b);
        return along(b, bc, (d4 - d3) / ((d4 - d3) + (d5 - d6)));
    }
    let denom = 1.0 / (va + vb + vc);
    let (v, w) = (vb * denom, vc * denom);
    at([
        a[0] + ab[0] * v + ac[0] * w,
        a[1] + ab[1] * v + ac[1] * w,
        a[2] + ab[2] * v + ac[2] * w,
    ])
}

/// Moves the triangles of `full` that are not on the surface of `metal` to the end.
pub fn split_meshes(full: &Mesh, metal: Mesh) -> Split {
    let bvh = Bvh::new(&metal);
    let mut near = Vec::new();
    let (mut keep, mut gem) = (Vec::new(), Vec::new());
    for t in &full.tris {
        let [a, b, c] = t.map(|i| full.verts[i as usize]);
        let m = [
            (a[0] + b[0] + c[0]) / 3.0,
            (a[1] + b[1] + c[1]) / 3.0,
            (a[2] + b[2] + c[2]) / 3.0,
        ];
        let lo = m.map(|x| x - ON_SURFACE);
        let hi = m.map(|x| x + ON_SURFACE);
        bvh.overlapping(lo, hi, &mut near);
        let on = near.iter().any(|&k| {
            let [p, q, r] = metal.tris[k].map(|i| metal.verts[i as usize]);
            point_tri(m, p, q, r) <= ON_SURFACE
        });
        if on {
            keep.push(*t);
        } else {
            gem.push(*t);
        }
    }
    let gem_tris = gem.len();
    keep.extend(gem);
    Split {
        full: Mesh {
            verts: full.verts.clone(),
            tris: keep,
        },
        metal,
        gem_tris,
    }
}

/// Renders the design with and without its stones. `None` when it has none (or no metal source).
pub fn split(source: &str, full: &Mesh) -> Option<Split> {
    let metal = render::render_plain(metal_source(source)?).ok()?.mesh;
    if full.is_empty() {
        return None;
    }
    let s = split_meshes(full, (*metal).clone());
    (s.gem_tris > 0).then_some(s)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::render::{RenderCache, render_on_big_stack};

    const RING: &str = "module gem() { children(); }\n\
        cube([10, 10, 2]);\n\
        gem() translate([5, 5, 2]) sphere(r = 2, $fn = 24);\n";

    #[test]
    fn no_gem_module_means_no_split() {
        assert!(metal_source("cube(2);").is_none());
        assert!(split("cube(2);", &Mesh::new()).is_none());
    }

    #[test]
    fn stones_are_told_from_metal() {
        let full = render_on_big_stack(RING.into(), &RenderCache::default()).unwrap().mesh;
        let s = split(RING, &full).expect("has gems");
        assert!(s.gem_tris > 10 && s.gem_tris < full.tris.len(), "{} of {}", s.gem_tris, full.tris.len());
        assert_eq!(s.full.tris.len(), full.tris.len());
        // the metal alone is the plate; the stone sits half in it
        assert!((s.metal.volume() - 200.0).abs() < 1e-6);
        // every stone triangle is above the plate
        let n = s.full.tris.len();
        for t in &s.full.tris[n - s.gem_tris..] {
            assert!(t.iter().any(|&i| s.full.verts[i as usize][2] > 2.0 - 1e-6));
        }
    }

    const GEMS: &str = include_str!("../kb/jewelry-components/gems.scad");
    const BANDS: &str = include_str!("../kb/jewelry-components/bands.scad");
    const PRONGS: &str = include_str!("../kb/jewelry-components/prongs.scad");
    const BEZEL: &str = include_str!("../kb/jewelry-components/bezel.scad");
    const FINDINGS: &str = include_str!("../kb/jewelry-components/findings.scad");

    /// Every `// demo:` line of a component file renders to a solid, closed piece.
    #[test]
    fn component_demos_render() {
        for (name, file, needs) in [
            ("gems", GEMS, ""),
            ("bands", BANDS, ""),
            ("prongs", PRONGS, GEMS),
            ("bezel", BEZEL, GEMS),
            ("findings", FINDINGS, ""),
        ] {
            let demos: Vec<&str> = file.lines().filter_map(|l| l.strip_prefix("// demo: ")).collect();
            assert!(!demos.is_empty(), "{name} has no demo");
            for demo in demos {
                let src = if needs.is_empty() || name == "gems" {
                    format!("{file}\n{demo}\n")
                } else {
                    format!("{needs}\n{file}\n{demo}\n")
                };
                let r = render_on_big_stack(src, &RenderCache::default())
                    .unwrap_or_else(|e| panic!("{name}: {demo}: {}", e.message));
                assert!(!r.mesh.is_empty(), "{name}: {demo} is empty");
                let stats = crate::meshtools::analyze(&r.mesh);
                assert_eq!(
                    stats.open_edges + stats.non_manifold_edges,
                    0,
                    "{name}: {demo} is not closed: {stats:?}"
                );
                assert!(r.mesh.volume() > 0.05, "{name}: {demo} has no volume");
            }
        }
    }

    /// The solitaire from the README: stone and setting split into gem and metal.
    #[test]
    fn readme_solitaire_splits() {
        let src = format!(
            "{GEMS}\n{BANDS}\n{PRONGS}\n\
            ring_band(17.3, 2.4, 1.6);\n\
            translate([0, 0, 17.3 / 2 + 1.6 - 0.3]) {{ prong_head(5); gem() round_brilliant(5); }}\n"
        );
        let full = render_on_big_stack(src.clone(), &RenderCache::default()).unwrap().mesh;
        let s = split(&src, &full).expect("stone found");
        assert!(s.gem_tris >= 16, "{}", s.gem_tris);
        assert!(s.metal.volume() > 30.0 && s.metal.volume() < full.volume() + 1.0);
    }

    #[test]
    fn the_sample_ring_has_a_stone() {
        let src = include_str!("../../src/sample.scad");
        let full = render_on_big_stack(src.into(), &RenderCache::default()).unwrap().mesh;
        let s = split(src, &full).expect("the sample has a gem()");
        assert!(s.gem_tris >= 16 && s.gem_tris < full.tris.len() / 2, "{}", s.gem_tris);
        assert!(s.metal.volume() < full.volume());
    }
}
