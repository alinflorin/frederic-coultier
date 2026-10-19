//! Mesh analysis, print checks, simplification and the casting sprue.

use std::collections::HashMap;

use meshopt_rs::simplify::simplify as meshopt_simplify;
use openrscad_geom::Mesh;
use serde::{Deserialize, Serialize};

use crate::supports::BED;

type V3 = [f64; 3];

const WELD_EPS: f64 = 1e-4;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshStats {
    pub triangles: usize,
    pub vertices: usize,
    pub volume: f64,
    pub area: f64,
    pub size: V3,
    pub shells: usize,
    pub open_edges: usize,
    pub non_manifold_edges: usize,
    /// Edges whose two triangles disagree on direction (inconsistent winding).
    pub winding_edges: usize,
    pub degenerate: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct Finding {
    /// "pass" | "warn" | "fail" | "info"
    pub level: &'static str,
    /// Stable key the UI translates.
    pub code: &'static str,
    pub detail: String,
    /// Where the problem is, in model coordinates.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub at: Vec<V3>,
    /// What was measured at each place in `at` (mm, or mm³ for cavities), when the check measures one.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub vals: Vec<f64>,
    /// Everything measured, for callers that want numbers rather than the sentence.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

impl Finding {
    pub fn new(level: &'static str, code: &'static str, detail: String) -> Self {
        Finding {
            level,
            code,
            detail,
            at: Vec::new(),
            vals: Vec::new(),
            data: None,
        }
    }
}

fn sub(a: V3, b: V3) -> V3 {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn dot(a: V3, b: V3) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
fn cross(a: V3, b: V3) -> V3 {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
fn norm(a: V3) -> f64 {
    dot(a, a).sqrt()
}

fn find(parent: &mut [usize], mut a: usize) -> usize {
    while parent[a] != a {
        parent[a] = parent[parent[a]];
        a = parent[a];
    }
    a
}

/// Topology and size of a mesh, measured after welding coincident vertices.
pub fn analyze(mesh: &Mesh) -> MeshStats {
    let m = mesh.welded(WELD_EPS);
    let degenerate = mesh.tris.len() - m.tris.len();

    let mut directed: HashMap<(u32, u32), u32> = HashMap::new();
    for t in &m.tris {
        for k in 0..3 {
            *directed.entry((t[k], t[(k + 1) % 3])).or_default() += 1;
        }
    }
    let (mut open, mut non_manifold, mut winding) = (0, 0, 0);
    for (&(a, b), &n) in &directed {
        let back = directed.get(&(b, a)).copied().unwrap_or(0);
        if a > b && back > 0 {
            continue; // undirected edge already counted from (b, a)
        }
        match (n, back) {
            (1, 0) | (0, 1) => open += 1,
            (1, 1) => {}
            (2, 0) | (0, 2) => winding += 1,
            _ => non_manifold += 1,
        }
    }

    let mut parent: Vec<usize> = (0..m.verts.len()).collect();
    for t in &m.tris {
        for k in 1..3 {
            let (ra, rb) = (
                find(&mut parent, t[0] as usize),
                find(&mut parent, t[k] as usize),
            );
            if ra != rb {
                parent[ra] = rb;
            }
        }
    }
    let mut roots = std::collections::HashSet::new();
    for t in &m.tris {
        roots.insert(find(&mut parent, t[0] as usize));
    }

    let size = m.bbox().map_or([0.0; 3], |(lo, hi)| sub(hi, lo));
    MeshStats {
        triangles: m.tris.len(),
        vertices: m.verts.len(),
        volume: m.signed_volume(),
        area: m.surface_area(),
        size,
        shells: roots.len(),
        open_edges: open,
        non_manifold_edges: non_manifold,
        winding_edges: winding,
        degenerate,
    }
}

/// Print-readiness checks (a subset of the original tool's `validate`).
pub fn validate(stats: &MeshStats) -> Vec<Finding> {
    let mut f = Vec::new();
    let mut add = |level, code, detail: String| {
        f.push(Finding::new(level, code, detail))
    };

    if stats.triangles == 0 {
        add("fail", "empty", String::new());
        return f;
    }
    add(
        "info",
        "size",
        format!(
            "{:.2} × {:.2} × {:.2} mm",
            stats.size[0], stats.size[1], stats.size[2]
        ),
    );
    add(
        "info",
        "counts",
        format!("{} / {}", stats.triangles, stats.shells),
    );

    if stats.open_edges + stats.non_manifold_edges + stats.winding_edges == 0 {
        add("pass", "watertight", String::new());
        if stats.volume < 0.0 {
            add("fail", "inverted", format!("{:.2}", stats.volume));
        } else {
            add("pass", "outward", String::new());
        }
    } else {
        if stats.open_edges > 0 {
            add("fail", "open", stats.open_edges.to_string());
        }
        if stats.non_manifold_edges > 0 {
            add("fail", "nonManifold", stats.non_manifold_edges.to_string());
        }
        if stats.winding_edges > 0 {
            add("fail", "winding", stats.winding_edges.to_string());
        }
    }
    if stats.degenerate > 0 {
        add("warn", "degenerate", stats.degenerate.to_string());
    }
    if stats.shells > 1 {
        add("warn", "shells", stats.shells.to_string());
    } else {
        add("pass", "oneShell", String::new());
    }

    let mut d = stats.size;
    d.sort_by(f64::total_cmp);
    let mut b = BED;
    b.sort_by(f64::total_cmp);
    if d[0] > b[0] || d[1] > b[1] || d[2] > b[2] {
        add("warn", "tooBig", String::new());
    } else {
        add("pass", "fits", String::new());
    }
    f
}

// --- simplification ---

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimplifySpec {
    /// Percentage of triangles to keep, 1-99.
    pub keep_percent: f64,
    /// Largest accepted volume change, percent.
    pub max_volume_change: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimplifyReport {
    pub before: usize,
    pub after: usize,
    pub accepted: bool,
    /// Why the result was rejected (the original is kept): "volume" | "bbox" | "open" | "nonManifold" | "stuck".
    pub reason: Option<&'static str>,
    pub volume_change: f64,
}

/// Quadric edge-collapse decimation, checked against the input: the result is
/// rejected (and the original returned) if the volume or bounding box moved,
/// or if the mesh stopped being closed or manifold.
pub fn simplify(mesh: &Mesh, spec: &SimplifySpec) -> (Mesh, SimplifyReport) {
    let welded = mesh.welded(WELD_EPS);
    let before = welded.tris.len();
    let stats_before = analyze(&welded);
    let mut first_failure: Option<(&'static str, usize, f64)> = None;

    // The decimator can occasionally fold an edge at an aggressive target; when the
    // check catches it, retry a little less aggressively before giving up.
    for step in [0.0, 0.25, 0.5] {
        let keep = spec.keep_percent + (100.0 - spec.keep_percent) * step;
        let target = ((before as f64 * keep / 100.0) as usize).max(100);
        if target >= before {
            break;
        }
        let result = decimate(&welded, target);
        match check(&welded, &stats_before, &result, spec) {
            Ok(vc) => {
                let after = result.tris.len();
                return (
                    result,
                    SimplifyReport {
                        before,
                        after,
                        accepted: true,
                        reason: None,
                        volume_change: vc,
                    },
                );
            }
            Err(f) => {
                first_failure.get_or_insert(f);
            }
        }
    }
    let (reason, after, vc) = first_failure.unwrap_or(("stuck", before, 0.0));
    (
        mesh.clone(),
        SimplifyReport {
            before,
            after,
            accepted: false,
            reason: Some(reason),
            volume_change: vc,
        },
    )
}

fn decimate(welded: &Mesh, target_tris: usize) -> Mesh {
    let verts: Vec<[f32; 3]> = welded
        .verts
        .iter()
        .map(|v| [v[0] as f32, v[1] as f32, v[2] as f32])
        .collect();
    let indices: Vec<u32> = welded.tris.iter().flatten().copied().collect();
    let mut out = vec![0u32; indices.len()];
    let n = meshopt_simplify(&mut out, &indices, &verts, target_tris * 3, 0.005);
    out.truncate(n);

    // compact: keep only referenced vertices, with the original f64 positions
    let mut remap: HashMap<u32, u32> = HashMap::new();
    let mut nv: Vec<V3> = Vec::new();
    let tris: Vec<[u32; 3]> = out
        .as_chunks::<3>().0.iter()
        .map(|t| {
            let mut r = [0u32; 3];
            for k in 0..3 {
                r[k] = *remap.entry(t[k]).or_insert_with(|| {
                    nv.push(welded.verts[t[k] as usize]);
                    (nv.len() - 1) as u32
                });
            }
            r
        })
        .collect();
    Mesh { verts: nv, tris }
}

/// Ok(volume change %) when `result` is a faithful, still-closed version of `welded`.
fn check(
    welded: &Mesh,
    a: &MeshStats,
    result: &Mesh,
    spec: &SimplifySpec,
) -> Result<f64, (&'static str, usize, f64)> {
    let b = analyze(result);
    let after = result.tris.len();
    let vc = if a.volume.abs() > 0.0 {
        100.0 * (b.volume - a.volume) / a.volume.abs()
    } else {
        0.0
    };
    if after >= welded.tris.len() {
        return Err(("stuck", after, vc));
    }
    if b.open_edges > a.open_edges {
        return Err(("open", after, vc));
    }
    if b.non_manifold_edges > a.non_manifold_edges || b.winding_edges > a.winding_edges {
        return Err(("nonManifold", after, vc));
    }
    if vc.abs() > spec.max_volume_change {
        return Err(("volume", after, vc));
    }
    if let (Some((alo, ahi)), Some((blo, bhi))) = (welded.bbox(), result.bbox()) {
        let moved = (0..3)
            .map(|k| (blo[k] - alo[k]).abs().max((bhi[k] - ahi[k]).abs()))
            .fold(0.0, f64::max);
        if moved > 0.05 {
            return Err(("bbox", after, vc));
        }
    }
    Ok(vc)
}

// --- sprue ---

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SprueSpec {
    pub diameter: f64,
    pub length: f64,
    /// Manual spot, in the mesh's own coordinates; snapped to the closest point of the surface.
    #[serde(default)]
    pub at: Option<V3>,
}

/// Closest point to `p` on triangle `abc` (Ericson, Real-Time Collision Detection).
pub(crate) fn closest_on_tri(p: V3, a: V3, b: V3, c: V3) -> V3 {
    let add = |u: V3, v: V3, k: f64| [u[0] + v[0] * k, u[1] + v[1] * k, u[2] + v[2] * k];
    let (ab, ac, ap) = (sub(b, a), sub(c, a), sub(p, a));
    let (d1, d2) = (dot(ab, ap), dot(ac, ap));
    if d1 <= 0.0 && d2 <= 0.0 {
        return a;
    }
    let bp = sub(p, b);
    let (d3, d4) = (dot(ab, bp), dot(ac, bp));
    if d3 >= 0.0 && d4 <= d3 {
        return b;
    }
    let vc = d1 * d4 - d3 * d2;
    if vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0 {
        return add(a, ab, d1 / (d1 - d3));
    }
    let cp = sub(p, c);
    let (d5, d6) = (dot(ab, cp), dot(ac, cp));
    if d6 >= 0.0 && d5 <= d6 {
        return c;
    }
    let vb = d5 * d2 - d1 * d6;
    if vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0 {
        return add(a, ac, d2 / (d2 - d6));
    }
    let va = d3 * d6 - d5 * d4;
    if va <= 0.0 && d4 - d3 >= 0.0 && d5 - d6 >= 0.0 {
        let w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return add(b, sub(c, b), w);
    }
    let denom = 1.0 / (va + vb + vc);
    add(add(a, ab, vb * denom), ac, vc * denom)
}

/// Distance along the ray `p + t d` to the nearest triangle (Möller–Trumbore), skipping `skip`.
fn ray_hit(m: &Mesh, p: V3, d: V3, skip: usize, max: f64) -> Option<f64> {
    let mut best: Option<f64> = None;
    for (i, t) in m.tris.iter().enumerate() {
        if i == skip {
            continue;
        }
        let [a, b, c] = t.map(|k| m.verts[k as usize]);
        let (e1, e2) = (sub(b, a), sub(c, a));
        let pv = cross(d, e2);
        let det = dot(e1, pv);
        if det.abs() < 1e-12 {
            continue;
        }
        let inv = 1.0 / det;
        let tv = sub(p, a);
        let u = dot(tv, pv) * inv;
        if !(0.0..=1.0).contains(&u) {
            continue;
        }
        let q = cross(tv, e1);
        let v = dot(d, q) * inv;
        if v < 0.0 || u + v > 1.0 {
            continue;
        }
        let t = dot(e2, q) * inv;
        if t > 1e-4 && t <= max && best.is_none_or(|b| t < b) {
            best = Some(t);
        }
    }
    best
}

/// A capped tube along unit `n` from `p`; `rings` are (distance along `n`, radius) pairs.
pub fn tube(p: V3, n: V3, rings: &[(f64, f64)]) -> Mesh {
    const N: usize = 24;
    let helper = if n[0].abs() < 0.6 {
        [1.0, 0.0, 0.0]
    } else {
        [0.0, 1.0, 0.0]
    };
    let u = cross(n, helper);
    let u = u.map(|x| x / norm(u));
    let v = cross(n, u);
    let mut m = Mesh::new();
    for &(h, rad) in rings {
        for i in 0..N {
            let a = std::f64::consts::TAU * i as f64 / N as f64;
            let (s, c) = a.sin_cos();
            m.verts.push([
                p[0] + n[0] * h + (u[0] * c + v[0] * s) * rad,
                p[1] + n[1] * h + (u[1] * c + v[1] * s) * rad,
                p[2] + n[2] * h + (u[2] * c + v[2] * s) * rad,
            ]);
        }
    }
    let n_ = N as u32;
    for ring in 0..rings.len() as u32 - 1 {
        for i in 0..n_ {
            let j = (i + 1) % n_;
            let (a, b, c, d) = (
                ring * n_ + i,
                ring * n_ + j,
                (ring + 1) * n_ + j,
                (ring + 1) * n_ + i,
            );
            m.tris.push([a, b, c]);
            m.tris.push([a, c, d]);
        }
    }
    let last = (rings.len() as u32 - 1) * n_;
    for i in 1..n_ - 1 {
        m.tris.push([0, i + 1, i]);
        m.tris.push([last, last + i, last + i + 1]);
    }
    m
}

/// Sprue stub: embedded 0.4 mm into the surface, flaring at its foot for a smooth blend.
fn stub(p: V3, n: V3, spec: &SprueSpec) -> Mesh {
    let r = spec.diameter / 2.0;
    tube(
        p,
        n,
        &[
            (-0.4, r * 0.9),
            (0.0, r * 0.9),
            (1.6, r),
            (spec.length.max(1.7), r),
        ],
    )
}

/// Places a sprue stub on the thickest, least visible spot: candidates are
/// ranked by local thickness, favouring faces that look towards the piece's
/// centre; the first one with free air in front of it wins.
/// Returns the stub mesh (to be fused with the piece) and the metal thickness behind it.
pub fn plan_sprue(mesh: &Mesh, spec: &SprueSpec) -> Option<(Mesh, f64)> {
    plan_sprue_at(mesh, spec).map(|(m, t, _)| (m, t))
}

/// Like [`plan_sprue`], also returning where the stub sits (the manual spot, snapped to the surface).
pub fn plan_sprue_at(mesh: &Mesh, spec: &SprueSpec) -> Option<(Mesh, f64, V3)> {
    let m = mesh.welded(WELD_EPS);
    if m.tris.is_empty() {
        return None;
    }
    let max_d = (1.5 * spec.diameter).max(2.5);

    if let Some(want) = spec.at {
        let mut best: Option<(f64, V3, V3)> = None;
        for t in &m.tris {
            let [a, b, c] = t.map(|k| m.verts[k as usize]);
            let cr = cross(sub(b, a), sub(c, a));
            let l = norm(cr);
            if l < 1e-9 {
                continue;
            }
            let q = closest_on_tri(want, a, b, c);
            let d = norm(sub(q, want));
            if best.is_none_or(|b| d < b.0) {
                best = Some((d, q, cr.map(|x| x / l)));
            }
        }
        let (_, q, n) = best?;
        let thick = ray_hit(&m, q, n.map(|x| -x), usize::MAX, max_d).unwrap_or(max_d);
        return Some((stub(q, n, spec), thick, q));
    }

    let mut centre = [0.0; 3];
    let mut asum = 0.0;
    let info: Vec<Option<(V3, V3, f64)>> = m
        .tris
        .iter()
        .map(|t| {
            let [a, b, c] = t.map(|k| m.verts[k as usize]);
            let cr = cross(sub(b, a), sub(c, a));
            let l = norm(cr);
            if l < 1e-9 {
                return None;
            }
            let cen = [
                (a[0] + b[0] + c[0]) / 3.0,
                (a[1] + b[1] + c[1]) / 3.0,
                (a[2] + b[2] + c[2]) / 3.0,
            ];
            for k in 0..3 {
                centre[k] += l * cen[k];
            }
            asum += l;
            Some((cen, cr.map(|x| x / l), l))
        })
        .collect();
    if asum > 0.0 {
        centre = centre.map(|x| x / asum);
    }

    let stride = (m.tris.len() / 700).max(1);
    let mut cands: Vec<(f64, usize)> = Vec::new();
    for i in (0..m.tris.len()).step_by(stride) {
        let Some((cen, n, _)) = info[i] else { continue };
        let thick = ray_hit(&m, cen, n.map(|x| -x), i, max_d).unwrap_or(max_d);
        let d = sub(cen, centre);
        let dd = norm(d);
        let o = if dd > 1e-9 { dot(d, n) / dd } else { 0.0 };
        cands.push((thick * (1.0 + (-o).max(0.0)), i));
    }
    cands.sort_by(|a, b| b.0.total_cmp(&a.0));

    for &(_, i) in cands.iter().take(25) {
        let Some((cen, n, _)) = info[i] else { continue };
        let start = [
            cen[0] + n[0] * 0.05,
            cen[1] + n[1] * 0.05,
            cen[2] + n[2] * 0.05,
        ];
        if ray_hit(&m, start, n, i, spec.length + 0.5).is_some() {
            continue; // the stub would run into the piece
        }
        let thick = ray_hit(&m, cen, n.map(|x| -x), i, max_d).unwrap_or(max_d);
        return Some((stub(cen, n, spec), thick, cen));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A UV sphere with plenty of triangles.
    fn sphere(r: f64, rings: usize, segs: usize) -> Mesh {
        let mut m = Mesh::new();
        m.verts.push([0.0, 0.0, r]);
        for i in 1..rings {
            let phi = std::f64::consts::PI * i as f64 / rings as f64;
            for j in 0..segs {
                let th = std::f64::consts::TAU * j as f64 / segs as f64;
                m.verts.push([
                    r * phi.sin() * th.cos(),
                    r * phi.sin() * th.sin(),
                    r * phi.cos(),
                ]);
            }
        }
        m.verts.push([0.0, 0.0, -r]);
        let ring = |i: usize, j: usize| (1 + (i - 1) * segs + j % segs) as u32;
        for j in 0..segs {
            m.tris.push([0, ring(1, j + 1), ring(1, j)]);
        }
        for i in 1..rings - 1 {
            for j in 0..segs {
                m.tris.push([ring(i, j), ring(i, j + 1), ring(i + 1, j)]);
                m.tris
                    .push([ring(i, j + 1), ring(i + 1, j + 1), ring(i + 1, j)]);
            }
        }
        let bottom = (m.verts.len() - 1) as u32;
        for j in 0..segs {
            m.tris
                .push([bottom, ring(rings - 1, j), ring(rings - 1, j + 1)]);
        }
        m.flip_winding();
        m
    }

    #[test]
    fn sphere_is_watertight_and_outward() {
        let s = analyze(&sphere(5.0, 24, 32));
        assert_eq!(
            (s.open_edges, s.non_manifold_edges, s.winding_edges),
            (0, 0, 0),
            "{s:?}"
        );
        assert_eq!(s.shells, 1);
        assert!(s.volume > 0.0);
        assert!(validate(&s).iter().all(|f| f.level != "fail"));
    }

    #[test]
    fn open_mesh_fails_validation() {
        let mut m = sphere(5.0, 12, 16);
        m.tris.pop();
        let f = validate(&analyze(&m));
        assert!(f.iter().any(|f| f.code == "open" && f.level == "fail"));
    }

    #[test]
    fn simplify_reduces_and_keeps_shape() {
        let m = sphere(10.0, 60, 90);
        let (out, rep) = simplify(
            &m,
            &SimplifySpec {
                keep_percent: 40.0,
                max_volume_change: 3.0,
            },
        );
        assert!(rep.accepted, "{rep:?}");
        assert!(out.tris.len() < m.tris.len() * 8 / 10, "{rep:?}");
        assert!(analyze(&out).open_edges == 0);
    }

    #[test]
    fn simplify_rejects_when_volume_limit_is_tight() {
        let m = sphere(10.0, 60, 90);
        let (out, rep) = simplify(
            &m,
            &SimplifySpec {
                keep_percent: 2.0,
                max_volume_change: 0.001,
            },
        );
        assert!(!rep.accepted);
        assert_eq!(out.tris.len(), m.tris.len(), "original kept");
    }

    #[test]
    fn sprue_sticks_out_of_the_surface() {
        let m = sphere(5.0, 24, 32);
        let (stub, thick) = plan_sprue(
            &m,
            &SprueSpec {
                diameter: 2.0,
                length: 5.0,
                at: None,
            },
        )
        .unwrap();
        assert!(thick > 1.0);
        let (lo, hi) = stub.bbox().unwrap();
        let reach = (0..3)
            .map(|k| lo[k].abs().max(hi[k].abs()))
            .fold(0.0, f64::max);
        assert!(
            reach > 5.0 + 4.0,
            "stub extends beyond the sphere, reach {reach}"
        );
    }
}
