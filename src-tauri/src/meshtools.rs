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

// --- repair ---

/// True when every edge has exactly two triangles that agree on direction.
pub fn is_clean(s: &MeshStats) -> bool {
    s.open_edges + s.non_manifold_edges + s.winding_edges == 0
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepairReport {
    pub before: MeshStats,
    pub after: MeshStats,
    /// Coincident triangles removed (same-direction copies, and opposite pairs that form an inner wall).
    pub duplicates_removed: usize,
    /// Triangles dropped where three or more met at one edge.
    pub non_manifold_removed: usize,
    /// Triangles turned around to agree with their neighbours.
    pub flipped: usize,
    pub holes_filled: usize,
    pub hole_triangles: usize,
    /// The whole mesh was turned inside out because it enclosed negative volume.
    pub inverted: bool,
}

fn edge_key(a: u32, b: u32) -> (u32, u32) {
    if a < b { (a, b) } else { (b, a) }
}

fn has_dir(t: &[u32; 3], a: u32, b: u32) -> bool {
    (0..3).any(|k| t[k] == a && t[(k + 1) % 3] == b)
}

fn tri_area(m: &Mesh, t: &[u32; 3]) -> f64 {
    let (a, b, c) = (m.verts[t[0] as usize], m.verts[t[1] as usize], m.verts[t[2] as usize]);
    norm(cross(sub(b, a), sub(c, a))) * 0.5
}

/// Closes up a damaged mesh: welds, drops duplicate and degenerate triangles, resolves edges shared
/// by more than two triangles, makes the winding consistent, fills open holes and faces the result
/// outward. Never fails; `after` in the report says what is left.
pub fn repair(mesh: &Mesh) -> (Mesh, RepairReport) {
    let before = analyze(mesh);
    let w = mesh.welded(WELD_EPS);

    // 1. duplicates: group by vertex set, cancel opposite pairs, keep one of identical copies
    let mut groups: HashMap<[u32; 3], (Vec<usize>, Vec<usize>)> = HashMap::new();
    let mut order: Vec<[u32; 3]> = Vec::new();
    for (i, t) in w.tris.iter().enumerate() {
        let mut k = *t;
        k.sort_unstable();
        let even = {
            let rot = (0..3).find(|&r| (0..3).all(|j| t[(r + j) % 3] == k[j]));
            rot.is_some()
        };
        let g = groups.entry(k).or_insert_with(|| {
            order.push(k);
            Default::default()
        });
        if even { g.0.push(i) } else { g.1.push(i) }
    }
    let mut tris: Vec<[u32; 3]> = Vec::new();
    let mut duplicates = 0;
    for k in &order {
        let (pos, neg) = &groups[k];
        let cancel = pos.len().min(neg.len());
        let (p, n) = (pos.len() - cancel, neg.len() - cancel);
        duplicates += pos.len() + neg.len() - (p.min(1) + n.min(1));
        if p > 0 { tris.push(w.tris[pos[0]]); }
        if n > 0 { tris.push(w.tris[neg[0]]); }
    }

    // 2. edges with 3+ triangles: keep the two largest
    let mut alive = vec![true; tris.len()];
    let mut edges: std::collections::BTreeMap<(u32, u32), Vec<usize>> = Default::default();
    for (i, t) in tris.iter().enumerate() {
        for k in 0..3 {
            edges.entry(edge_key(t[k], t[(k + 1) % 3])).or_default().push(i);
        }
    }
    let mut non_manifold_removed = 0;
    for faces in edges.values() {
        let mut live: Vec<usize> = faces.iter().copied().filter(|&f| alive[f]).collect();
        if live.len() <= 2 {
            continue;
        }
        live.sort_by(|&a, &b| tri_area(&w, &tris[b]).total_cmp(&tri_area(&w, &tris[a])));
        for &f in &live[2..] {
            alive[f] = false;
            non_manifold_removed += 1;
        }
    }
    let mut tris: Vec<[u32; 3]> =
        tris.iter().zip(&alive).filter(|(_, a)| **a).map(|(t, _)| *t).collect();

    // 3. consistent winding, flooding across edges shared by exactly two triangles
    let mut edges: HashMap<(u32, u32), Vec<usize>> = HashMap::new();
    for (i, t) in tris.iter().enumerate() {
        for k in 0..3 {
            edges.entry(edge_key(t[k], t[(k + 1) % 3])).or_default().push(i);
        }
    }
    let mut seen = vec![false; tris.len()];
    let mut flipped = 0;
    for s in 0..tris.len() {
        if seen[s] {
            continue;
        }
        seen[s] = true;
        let mut stack = vec![s];
        while let Some(f) = stack.pop() {
            let t = tris[f];
            for k in 0..3 {
                let (a, b) = (t[k], t[(k + 1) % 3]);
                let Some(fs) = edges.get(&edge_key(a, b)) else { continue };
                if fs.len() != 2 {
                    continue;
                }
                let g = if fs[0] == f { fs[1] } else { fs[0] };
                if seen[g] {
                    continue;
                }
                seen[g] = true;
                if has_dir(&tris[g], a, b) {
                    tris[g].swap(1, 2);
                    flipped += 1;
                }
                stack.push(g);
            }
        }
    }

    // 4. fill holes: boundary edges are directed edges whose reverse is absent
    let mut directed: std::collections::HashSet<(u32, u32)> = Default::default();
    for t in &tris {
        for k in 0..3 {
            directed.insert((t[k], t[(k + 1) % 3]));
        }
    }
    let mut boundary: Vec<(u32, u32)> =
        directed.iter().copied().filter(|&(a, b)| !directed.contains(&(b, a))).collect();
    boundary.sort_unstable();
    let mut out: HashMap<u32, Vec<u32>> = HashMap::new();
    for &(a, b) in &boundary {
        out.entry(a).or_default().push(b);
    }
    let mut verts = w.verts.clone();
    let (mut holes_filled, mut hole_triangles) = (0, 0);
    for &(a0, b0) in &boundary {
        if !out.get(&a0).is_some_and(|v| v.contains(&b0)) {
            continue; // already part of a loop
        }
        let mut lp = vec![a0];
        let mut cur = b0;
        out.get_mut(&a0).unwrap().retain(|&x| x != b0);
        let closed = loop {
            if cur == a0 {
                break true;
            }
            lp.push(cur);
            let Some(next) = out.get_mut(&cur).and_then(|v| (!v.is_empty()).then(|| v.remove(0)))
            else {
                break false;
            };
            cur = next;
        };
        if !closed || lp.len() < 3 {
            continue;
        }
        holes_filled += 1;
        if lp.len() == 3 {
            tris.push([lp[0], lp[2], lp[1]]);
            hole_triangles += 1;
            continue;
        }
        let n = lp.len() as f64;
        let mut c = [0.0; 3];
        for &v in &lp {
            for k in 0..3 {
                c[k] += verts[v as usize][k] / n;
            }
        }
        verts.push(c);
        let ci = (verts.len() - 1) as u32;
        for i in 0..lp.len() {
            tris.push([lp[(i + 1) % lp.len()], lp[i], ci]);
            hole_triangles += 1;
        }
    }

    // 5. compact and face outward
    let mut remap: HashMap<u32, u32> = HashMap::new();
    let mut nv: Vec<V3> = Vec::new();
    let tris: Vec<[u32; 3]> = tris
        .iter()
        .map(|t| {
            let mut r = [0u32; 3];
            for k in 0..3 {
                r[k] = *remap.entry(t[k]).or_insert_with(|| {
                    nv.push(verts[t[k] as usize]);
                    (nv.len() - 1) as u32
                });
            }
            r
        })
        .collect();
    let mut result = Mesh { verts: nv, tris };
    let inverted = result.signed_volume() < 0.0;
    if inverted {
        result.flip_winding();
    }
    let after = analyze(&result);
    (
        result,
        RepairReport {
            before,
            after,
            duplicates_removed: duplicates,
            non_manifold_removed,
            flipped,
            holes_filled,
            hole_triangles,
            inverted,
        },
    )
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
    /// The input was open or non-manifold, so it was repaired before being simplified.
    pub repaired: bool,
}

/// Quadric edge-collapse decimation, checked against the input: the result is
/// rejected (and the original returned) if the volume or bounding box moved,
/// or if the mesh stopped being closed or manifold.
pub fn simplify(mesh: &Mesh, spec: &SimplifySpec) -> (Mesh, SimplifyReport) {
    let welded = mesh.welded(WELD_EPS);
    let before = welded.tris.len();
    let stats_before = analyze(&welded);
    let accepted = |m: Mesh, vc: f64, repaired: bool| {
        let after = m.tris.len();
        let report = SimplifyReport {
            before,
            after,
            accepted: true,
            reason: None,
            volume_change: vc,
            repaired,
        };
        (m, report)
    };

    // A mesh that is open or non-manifold gives the decimator little it can collapse safely (it
    // either refuses or barely reduces anything), so repair it first and simplify the repaired mesh.
    // If that is refused too, fall back to simplifying the mesh as it came.
    if !is_clean(&stats_before) {
        let (fixed, _) = repair(&welded);
        let stats_fixed = analyze(&fixed);
        if let Ok((m, vc)) = run_simplify(&fixed, &stats_fixed, spec) {
            return accepted(m, vc, true);
        }
    }
    let first_failure = match run_simplify(&welded, &stats_before, spec) {
        Ok((m, vc)) => return accepted(m, vc, false),
        Err(f) => f,
    };

    let (reason, after, vc) = first_failure;
    (
        mesh.clone(),
        SimplifyReport {
            before,
            after,
            accepted: false,
            reason: Some(reason),
            volume_change: vc,
            repaired: false,
        },
    )
}

/// Decimation of `welded` toward the requested size; Ok((mesh, volume change %)) or why it was refused.
fn run_simplify(
    welded: &Mesh,
    stats_before: &MeshStats,
    spec: &SimplifySpec,
) -> Result<(Mesh, f64), (&'static str, usize, f64)> {
    let before = welded.tris.len();
    let mut first_failure: Option<(&'static str, usize, f64)> = None;

    // The decimator can occasionally fold an edge at an aggressive target; when the
    // check catches it, retry a little less aggressively before giving up.
    for step in [0.0, 0.25, 0.5] {
        let keep = spec.keep_percent + (100.0 - spec.keep_percent) * step;
        let target = ((before as f64 * keep / 100.0) as usize).max(100);
        if target >= before {
            break;
        }
        let result = decimate(welded, target);
        match check(welded, stats_before, &result, spec) {
            Ok(vc) => return Ok((result, vc)),
            Err(f) => {
                first_failure.get_or_insert(f);
            }
        }
    }
    Err(first_failure.unwrap_or(("stuck", before, 0.0)))
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

    fn damaged_sphere(f: impl FnOnce(&mut Mesh)) -> (Mesh, f64) {
        let mut m = sphere(10.0, 16, 24);
        let v = m.signed_volume();
        f(&mut m);
        (m, v)
    }

    #[test]
    fn repair_leaves_a_clean_mesh_alone() {
        let m = sphere(10.0, 16, 24);
        let (r, rep) = repair(&m);
        assert!(is_clean(&rep.after));
        assert_eq!(r.tris.len(), m.tris.len());
        assert_eq!(rep.holes_filled + rep.flipped + rep.non_manifold_removed, 0);
    }

    #[test]
    fn repair_fills_a_hole() {
        let (m, v) = damaged_sphere(|m| {
            m.tris.truncate(m.tris.len() - 3);
        });
        assert!(!is_clean(&analyze(&m)));
        let (r, rep) = repair(&m);
        assert!(is_clean(&rep.after), "{:?}", rep.after);
        assert!(rep.holes_filled >= 1);
        assert!((r.signed_volume() - v).abs() / v < 0.05);
    }

    #[test]
    fn repair_fixes_flipped_and_duplicate_triangles() {
        let (m, v) = damaged_sphere(|m| {
            m.tris[10].swap(1, 2);
            m.tris[40].swap(1, 2);
            let d = m.tris[70];
            m.tris.push(d);
        });
        let (r, rep) = repair(&m);
        assert!(is_clean(&rep.after), "{:?}", rep.after);
        assert_eq!(rep.flipped, 2);
        assert_eq!(rep.duplicates_removed, 1);
        assert!((r.signed_volume() - v).abs() / v < 1e-6);
    }

    #[test]
    fn repair_turns_an_inside_out_mesh_outward() {
        let (m, v) = damaged_sphere(|m| m.flip_winding());
        let (r, rep) = repair(&m);
        assert!(rep.inverted);
        assert!((r.signed_volume() - v).abs() / v < 1e-6);
    }

    #[test]
    fn repair_resolves_a_third_face_on_an_edge() {
        let (m, _) = damaged_sphere(|m| {
            // a fin: one more triangle hanging off an existing edge
            let t = m.tris[5];
            m.verts.push([40.0, 40.0, 40.0]);
            let n = (m.verts.len() - 1) as u32;
            m.tris.push([t[1], t[0], n]);
        });
        assert!(analyze(&m).non_manifold_edges > 0);
        let (_, rep) = repair(&m);
        assert!(is_clean(&rep.after), "{:?}", rep.after);
        assert!(rep.non_manifold_removed >= 1);
    }

    #[test]
    fn simplify_falls_back_to_repair() {
        let (m, _) = damaged_sphere(|m| {
            for i in (3..m.tris.len()).step_by(7) {
                m.tris[i].swap(1, 2);
            }
        });
        let (out, rep) = simplify(&m, &SimplifySpec { keep_percent: 20.0, max_volume_change: 20.0 });
        assert!(rep.repaired);
        assert!(rep.accepted, "{:?}", rep.reason);
        assert!(out.tris.len() < m.tris.len());
        assert!(is_clean(&analyze(&out)));
    }

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
