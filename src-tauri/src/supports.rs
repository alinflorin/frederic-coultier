//! Resin-print supports: print-orientation ranking, automatic contact-point
//! placement and baking supports + raft into a print-ready mesh.
//!
//! Contact points are stored in the model's own coordinates, so they stay put
//! when the tilt changes. The print frame is the model rotated by `tilt`
//! degrees about X and lifted `lift` mm above the plate.

use std::collections::HashMap;
use std::f64::consts::PI;

use openrscad_geom::Mesh;
use serde::{Deserialize, Serialize};

/// Build volume of the target printer (Elegoo Mars 5), mm.
pub const BED: [f64; 3] = [153.4, 77.0, 150.0];

type V3 = [f64; 3];

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintParams {
    pub tilt: f64,
    pub lift: f64,
    pub tip: f64,
    pub base: f64,
    /// Raft thickness, 0 = no raft. Must be thinner than `lift`.
    pub raft: f64,
    pub raft_radius: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Support {
    pub id: u32,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    /// "auto" or "manual"
    pub source: String,
    #[serde(default)]
    pub tip: Option<f64>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoParams {
    /// Faces pointing down within this many degrees of horizontal need support.
    pub angle: f64,
    /// Largest distance one support may serve, mm.
    pub spacing: f64,
    /// Surface sampling resolution, mm.
    pub step: f64,
    /// Prefer inner surfaces by up to this many mm of height.
    pub bias: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoStats {
    pub overhang_faces: usize,
    pub samples: usize,
    pub added: usize,
    pub kept: usize,
    pub blocked: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoResult {
    pub supports: Vec<Support>,
    pub next_id: u32,
    pub stats: AutoStats,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TiltRow {
    pub tilt: f64,
    pub overhang: f64,
    pub flat: f64,
    pub size: [f64; 3],
    pub fits: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Frame {
    pub size: [f64; 3],
    pub fits: bool,
}

// --- small vector helpers ---

fn sub(a: V3, b: V3) -> V3 {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn cross(a: V3, b: V3) -> V3 {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
fn len(a: V3) -> f64 {
    (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]).sqrt()
}

/// Rotates a model-frame point into the print frame (without the lift).
fn tilt_point(p: V3, tilt_deg: f64) -> V3 {
    let (s, c) = (tilt_deg * PI / 180.0).sin_cos();
    [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]
}

fn tilt_mesh(mesh: &Mesh, tilt: f64) -> Vec<V3> {
    mesh.verts.iter().map(|&v| tilt_point(v, tilt)).collect()
}

fn bounds(verts: &[V3]) -> Option<(V3, V3)> {
    let mut it = verts.iter();
    let first = *it.next()?;
    let (mut lo, mut hi) = (first, first);
    for v in it {
        for k in 0..3 {
            lo[k] = lo[k].min(v[k]);
            hi[k] = hi[k].max(v[k]);
        }
    }
    Some((lo, hi))
}

/// Size of the tilted, lifted model (z includes the lift), and whether it fits the plate.
pub fn frame(mesh: &Mesh, p: &PrintParams) -> Option<(f64, Frame)> {
    let v = tilt_mesh(mesh, p.tilt);
    let (lo, hi) = bounds(&v)?;
    let size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2] + p.lift];
    let fits = size[0] <= BED[0] && size[1] <= BED[1] && size[2] <= BED[2];
    Some((p.lift - lo[2], Frame { size, fits }))
}

/// Unit normal and area of a triangle (None when degenerate).
fn tri_normal(a: V3, b: V3, c: V3) -> Option<(V3, f64)> {
    let n = cross(sub(b, a), sub(c, a));
    let l = len(n);
    if l < 1e-12 {
        None
    } else {
        Some(([n[0] / l, n[1] / l, n[2] / l], l / 2.0))
    }
}

// --- print orientation ---

/// Ranks tilts about X from `min` to `max`: overhanging area (needs supports)
/// plus 3x the flat area lying on the plate, best first.
pub fn rank_tilts(
    mesh: &Mesh,
    min: f64,
    max: f64,
    step: f64,
    angle: f64,
    lift: f64,
) -> Vec<TiltRow> {
    let ct = (angle * PI / 180.0).cos();
    let tris: Vec<(V3, f64, [usize; 3])> = mesh
        .tris
        .iter()
        .filter_map(|t| {
            let [a, b, c] = t.map(|i| mesh.verts[i as usize]);
            tri_normal(a, b, c).map(|(n, area)| (n, area, t.map(|i| i as usize)))
        })
        .collect();

    let mut rows = Vec::new();
    let mut tilt = min;
    while tilt <= max + 1e-9 {
        let (s, c) = (tilt * PI / 180.0).sin_cos();
        let v = tilt_mesh(mesh, tilt);
        if let Some((lo, hi)) = bounds(&v) {
            let (mut over, mut flat) = (0.0, 0.0);
            for (n, area, idx) in &tris {
                let nz = n[1] * s + n[2] * c;
                if nz < -ct {
                    over += area;
                }
                if nz < -0.995 {
                    let zc = (v[idx[0]][2] + v[idx[1]][2] + v[idx[2]][2]) / 3.0;
                    if zc - lo[2] < 0.05 {
                        flat += area;
                    }
                }
            }
            let size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2] + lift];
            let fits = size[0] <= BED[0] && size[1] <= BED[1] && size[2] <= BED[2];
            rows.push(TiltRow {
                tilt,
                overhang: over,
                flat,
                size,
                fits,
            });
        }
        tilt += step;
    }
    let score = |r: &TiltRow| {
        if r.fits {
            r.overhang + 3.0 * r.flat
        } else {
            1e12 + r.overhang
        }
    };
    rows.sort_by(|a, b| score(a).total_cmp(&score(b)));
    rows
}

// --- automatic placement ---

/// Triangles bucketed on an XY grid, to answer "is anything below this point?".
struct XyGrid {
    x0: f64,
    y0: f64,
    cell: f64,
    nx: usize,
    ny: usize,
    cells: HashMap<usize, Vec<u32>>,
}

impl XyGrid {
    fn new(v: &[V3], tris: &[[u32; 3]], tri_box: &[[f64; 6]]) -> Self {
        let (lo, hi) = bounds(v).unwrap_or(([0.0; 3], [1.0; 3]));
        let span = (hi[0] - lo[0]).max(hi[1] - lo[1]).max(1.0);
        let cell = (span / 128.0).max(0.25);
        let nx = ((hi[0] - lo[0]) / cell) as usize + 1;
        let ny = ((hi[1] - lo[1]) / cell) as usize + 1;
        let mut g = XyGrid {
            x0: lo[0],
            y0: lo[1],
            cell,
            nx,
            ny,
            cells: HashMap::new(),
        };
        for (t, b) in tri_box.iter().enumerate().take(tris.len()) {
            let (ix0, ix1) = (g.ix(b[0]), g.ix(b[3]));
            let (iy0, iy1) = (g.iy(b[1]), g.iy(b[4]));
            for ix in ix0..=ix1 {
                for iy in iy0..=iy1 {
                    g.cells.entry(ix * ny + iy).or_default().push(t as u32);
                }
            }
        }
        g
    }
    fn ix(&self, x: f64) -> usize {
        (((x - self.x0) / self.cell).floor().max(0.0) as usize).min(self.nx - 1)
    }
    fn iy(&self, y: f64) -> usize {
        (((y - self.y0) / self.cell).floor().max(0.0) as usize).min(self.ny - 1)
    }
}

/// Places as few supports as possible under overhanging faces.
///
/// `manual` supports are kept and count towards coverage. The result lists the
/// kept manual supports followed by the new automatic ones.
pub fn auto_supports(
    mesh: &Mesh,
    print: &PrintParams,
    auto: &AutoParams,
    manual: &[Support],
    mut next_id: u32,
) -> Option<AutoResult> {
    let (zoff, _) = frame(mesh, print)?;
    let v: Vec<V3> = tilt_mesh(mesh, print.tilt)
        .into_iter()
        .map(|p| [p[0], p[1], p[2] + zoff])
        .collect();
    let tol = 0.3;

    let tri_box: Vec<[f64; 6]> = mesh
        .tris
        .iter()
        .map(|t| {
            let p = t.map(|i| v[i as usize]);
            let mut b = [f64::MAX, f64::MAX, f64::MAX, f64::MIN, f64::MIN, f64::MIN];
            for q in p {
                for k in 0..3 {
                    b[k] = b[k].min(q[k]);
                    b[k + 3] = b[k + 3].max(q[k]);
                }
            }
            b
        })
        .collect();
    let grid = XyGrid::new(&v, &mesh.tris, &tri_box);

    // would a pillar straight down from p cross the model?
    let blocked = |p: V3| -> bool {
        let Some(list) = grid.cells.get(&(grid.ix(p[0]) * grid.ny + grid.iy(p[1]))) else {
            return false;
        };
        for &t in list {
            let b = &tri_box[t as usize];
            if p[0] < b[0] || p[0] > b[3] || p[1] < b[1] || p[1] > b[4] || b[2] > p[2] - tol {
                continue;
            }
            let [a0, a1, a2] = mesh.tris[t as usize].map(|i| v[i as usize]);
            let (v0x, v0y, v1x, v1y) = (a1[0] - a0[0], a1[1] - a0[1], a2[0] - a0[0], a2[1] - a0[1]);
            let (v2x, v2y) = (p[0] - a0[0], p[1] - a0[1]);
            let den = v0x * v1y - v1x * v0y;
            if den.abs() < 1e-12 {
                continue;
            }
            let u = (v2x * v1y - v1x * v2y) / den;
            let w = (v0x * v2y - v2x * v0y) / den;
            if u < -1e-9 || w < -1e-9 || u + w > 1.0 + 1e-9 {
                continue;
            }
            let zh = a0[2] + u * (a1[2] - a0[2]) + w * (a2[2] - a0[2]);
            if zh < p[2] - tol {
                return true;
            }
        }
        false
    };

    // area-weighted centre of the surface: faces looking at it are "inner" faces
    let (mut centre, mut asum) = ([0.0; 3], 0.0);
    for t in &mesh.tris {
        let [a, b, c] = t.map(|i| v[i as usize]);
        let l = len(cross(sub(b, a), sub(c, a)));
        for k in 0..3 {
            centre[k] += l * (a[k] + b[k] + c[k]) / 3.0;
        }
        asum += l;
    }
    if asum > 0.0 {
        centre = centre.map(|x| x / asum);
    }

    // samples on overhanging faces
    let ct = (auto.angle * PI / 180.0).cos();
    let step = auto.step.max(0.05);
    let (mut overhang_faces, mut samples): (usize, Vec<(f64, V3)>) = (0, Vec::new());
    for t in &mesh.tris {
        let [a, b, c] = t.map(|i| v[i as usize]);
        let cr = cross(sub(b, a), sub(c, a));
        let l = len(cr);
        if l < 1e-12 || cr[2] / l >= -ct {
            continue;
        }
        overhang_faces += 1;
        let (e1, e2) = (sub(b, a), sub(c, a));
        let m = len(e1).max(len(e2)).max(len(sub(c, b)));
        let n = ((m / step) as usize + 1).min(40);
        for a1 in 0..n {
            for b1 in 0..(n - a1) {
                let (u, w) = (
                    (a1 as f64 + 1.0 / 3.0) / n as f64,
                    (b1 as f64 + 1.0 / 3.0) / n as f64,
                );
                let p = [
                    a[0] + u * e1[0] + w * e2[0],
                    a[1] + u * e1[1] + w * e2[1],
                    a[2] + u * e1[2] + w * e2[2],
                ];
                let d = sub(p, centre);
                let dd = len(d);
                let o = if dd > 1e-9 {
                    (d[0] * cr[0] + d[1] * cr[1] + d[2] * cr[2]) / (dd * l)
                } else {
                    0.0
                };
                samples.push((p[2] + auto.bias * (o + 1.0) / 2.0, p));
            }
        }
    }
    samples.sort_by(|a, b| a.0.total_cmp(&b.0));

    // existing manual supports, in the print frame
    let mut placed: Vec<V3> = manual
        .iter()
        .map(|s| {
            let p = tilt_point([s.x, s.y, s.z], print.tilt);
            [p[0], p[1], p[2] + zoff]
        })
        .collect();
    let kept = manual.len();
    let sp2 = auto.spacing * auto.spacing;
    let (c, s) = (
        (print.tilt * PI / 180.0).cos(),
        (print.tilt * PI / 180.0).sin(),
    );

    let mut out: Vec<Support> = manual.to_vec();
    let (mut added, mut blocked_n) = (0, 0);
    for (_, p) in &samples {
        if placed.iter().any(|q| {
            let d = sub(*p, *q);
            d[0] * d[0] + d[1] * d[1] + d[2] * d[2] < sp2
        }) {
            continue;
        }
        if blocked(*p) {
            blocked_n += 1;
            continue;
        }
        placed.push(*p);
        added += 1;
        let z0 = p[2] - zoff; // back to the model frame
        out.push(Support {
            id: next_id,
            x: p[0],
            y: p[1] * c + z0 * s,
            z: -p[1] * s + z0 * c,
            source: "auto".into(),
            tip: None,
        });
        next_id += 1;
    }
    Some(AutoResult {
        supports: out,
        next_id,
        stats: AutoStats {
            overhang_faces,
            samples: samples.len(),
            added,
            kept,
            blocked: blocked_n,
        },
    })
}

// --- geometry ---

fn append(into: &mut Mesh, verts: Vec<V3>, tris: Vec<[u32; 3]>) {
    let base = into.verts.len() as u32;
    into.verts.extend(verts);
    into.tris
        .extend(tris.into_iter().map(|t| t.map(|i| i + base)));
}

/// Closed prism over a convex polygon (counter-clockwise seen from +Z).
fn prism(poly: &[[f64; 2]], z0: f64, z1: f64) -> (Vec<V3>, Vec<[u32; 3]>) {
    let n = poly.len() as u32;
    let mut v: Vec<V3> = poly.iter().map(|p| [p[0], p[1], z0]).collect();
    v.extend(poly.iter().map(|p| [p[0], p[1], z1]));
    let mut t = Vec::new();
    for i in 1..n - 1 {
        t.push([0, i + 1, i]); // bottom faces down
        t.push([n, n + i, n + i + 1]); // top faces up
    }
    for i in 0..n {
        let j = (i + 1) % n;
        t.push([i, j, n + j]);
        t.push([i, n + j, n + i]);
    }
    (v, t)
}

fn circle(cx: f64, cy: f64, r: f64, n: usize) -> Vec<[f64; 2]> {
    (0..n)
        .map(|i| {
            let a = 2.0 * PI * i as f64 / n as f64;
            [cx + r * a.cos(), cy + r * a.sin()]
        })
        .collect()
}

/// Stadium (hull of two discs) around the segment p-q.
fn stadium(p: [f64; 2], q: [f64; 2], r: f64) -> Vec<[f64; 2]> {
    let ang = (q[1] - p[1]).atan2(q[0] - p[0]);
    let half = 12;
    let mut poly = Vec::new();
    for i in 0..=half {
        let a = ang - PI / 2.0 + PI * i as f64 / half as f64;
        poly.push([q[0] + r * a.cos(), q[1] + r * a.sin()]);
    }
    for i in 0..=half {
        let a = ang + PI / 2.0 + PI * i as f64 / half as f64;
        poly.push([p[0] + r * a.cos(), p[1] + r * a.sin()]);
    }
    poly
}

/// Tapered pillar from `(x, y, z0)` with radius `r0` up to `(x, y, z1)` with radius `r1`.
fn pillar(x: f64, y: f64, z0: f64, r0: f64, z1: f64, r1: f64) -> (Vec<V3>, Vec<[u32; 3]>) {
    const N: usize = 16;
    let mut v: Vec<V3> = circle(x, y, r0, N)
        .into_iter()
        .map(|p| [p[0], p[1], z0])
        .collect();
    v.extend(circle(x, y, r1, N).into_iter().map(|p| [p[0], p[1], z1]));
    let n = N as u32;
    let mut t = Vec::new();
    for i in 1..n - 1 {
        t.push([0, i + 1, i]);
        t.push([n, n + i, n + i + 1]);
    }
    for i in 0..n {
        let j = (i + 1) % n;
        t.push([i, j, n + j]);
        t.push([i, n + j, n + i]);
    }
    (v, t)
}

/// Pillars and raft only, in the print frame.
pub fn support_parts(supports: &[Support], p: &PrintParams, zoff: f64) -> Vec<Mesh> {
    let mut parts: Vec<Mesh> = Vec::new();
    let pts: Vec<(V3, f64)> = supports
        .iter()
        .map(|s| {
            let q = tilt_point([s.x, s.y, s.z], p.tilt);
            ([q[0], q[1], q[2] + zoff], s.tip.unwrap_or(p.tip))
        })
        .collect();

    let raft_top = p.raft.min(p.lift - 0.05).max(0.0);
    let z0 = if raft_top > 0.0 { raft_top - 0.1 } else { 0.0 };
    for (q, tip) in &pts {
        let z1 = q[2] + 0.3 * tip; // the tip sinks slightly into the surface
        if z1 - z0 > 0.2 {
            let (v, t) = pillar(q[0], q[1], z0, p.base, z1, *tip);
            parts.push(Mesh { verts: v, tris: t });
        }
    }

    if raft_top > 0.0 && !pts.is_empty() {
        // shortest links between supports (Prim's tree): one connected raft, little resin
        let xy: Vec<[f64; 2]> = pts.iter().map(|(q, _)| [q[0], q[1]]).collect();
        let n = xy.len();
        let (mut used, mut d, mut par) = (vec![false; n], vec![f64::MAX; n], vec![usize::MAX; n]);
        d[0] = 0.0;
        for _ in 0..n {
            let b = (0..n)
                .filter(|&i| !used[i])
                .min_by(|&a, &b| d[a].total_cmp(&d[b]))
                .unwrap();
            used[b] = true;
            let poly = if par[b] == usize::MAX {
                circle(xy[b][0], xy[b][1], p.raft_radius, 32)
            } else {
                stadium(xy[b], xy[par[b]], p.raft_radius)
            };
            let (v, t) = prism(&poly, 0.0, raft_top);
            parts.push(Mesh { verts: v, tris: t });
            for i in 0..n {
                if !used[i] {
                    let e = (xy[i][0] - xy[b][0]).powi(2) + (xy[i][1] - xy[b][1]).powi(2);
                    if e < d[i] {
                        d[i] = e;
                        par[i] = b;
                    }
                }
            }
        }
    }
    parts
}

/// Pillars and raft as one mesh (overlapping shells, for display).
pub fn support_mesh(supports: &[Support], p: &PrintParams, zoff: f64) -> Mesh {
    let mut m = Mesh::new();
    for part in support_parts(supports, p, zoff) {
        append(&mut m, part.verts, part.tris);
    }
    m
}

/// The model in the print frame (tilted, lifted).
pub fn tilted_model(mesh: &Mesh, p: &PrintParams, zoff: f64) -> Mesh {
    Mesh {
        verts: tilt_mesh(mesh, p.tilt)
            .into_iter()
            .map(|q| [q[0], q[1], q[2] + zoff])
            .collect(),
        tris: mesh.tris.clone(),
    }
}

/// Print-ready mesh: tilted model fused with the supports and raft.
pub fn bake(mesh: &Mesh, supports: &[Support], p: &PrintParams) -> Option<Mesh> {
    let (zoff, _) = frame(mesh, p)?;
    let mut parts = vec![tilted_model(mesh, p, zoff)];
    parts.extend(support_parts(supports, p, zoff));
    Some(crate::hollow::fuse(parts))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A ring-like overhang: a flat plate sitting 5 mm above z=0 on a pole.
    fn mushroom() -> Mesh {
        let mut m = Mesh::new();
        let (v, t) = prism(&circle(0.0, 0.0, 5.0, 24), 5.0, 6.0);
        append(&mut m, v, t);
        let (v, t) = prism(&circle(0.0, 0.0, 1.0, 12), 0.0, 5.0);
        append(&mut m, v, t);
        m
    }

    fn params(tilt: f64) -> PrintParams {
        PrintParams {
            tilt,
            lift: 3.0,
            tip: 0.2,
            base: 0.8,
            raft: 1.0,
            raft_radius: 3.0,
        }
    }
    const AUTO: AutoParams = AutoParams {
        angle: 45.0,
        spacing: 4.0,
        step: 1.0,
        bias: 3.0,
    };

    #[test]
    fn prism_is_closed_and_positive() {
        let (v, t) = prism(&circle(0.0, 0.0, 2.0, 16), 0.0, 3.0);
        let m = Mesh { verts: v, tris: t };
        assert!(m.signed_volume() > 0.0);
        assert!((m.volume() - 3.0 * 2.0 * 2.0 * 16.0 / 2.0 * (2.0 * PI / 16.0).sin()).abs() < 1e-6);
    }

    #[test]
    fn plate_overhang_gets_supports_under_it() {
        let m = mushroom();
        let r = auto_supports(&m, &params(0.0), &AUTO, &[], 1).unwrap();
        assert!(r.stats.added >= 2, "{:?}", r.stats);
        // contacts sit on downward faces only: the plate underside (z = 5) or the pole's foot (z = 0)
        for s in &r.supports {
            assert!(s.z.abs() < 0.1 || (s.z - 5.0).abs() < 0.1, "{s:?}");
        }
        assert!(r.supports.iter().any(|s| (s.z - 5.0).abs() < 0.1));
    }

    #[test]
    fn manual_supports_are_kept_and_count_for_coverage() {
        let m = mushroom();
        let manual = vec![Support {
            id: 1,
            x: 0.0,
            y: 0.0,
            z: 5.0,
            source: "manual".into(),
            tip: None,
        }];
        let with = auto_supports(&m, &params(0.0), &AUTO, &manual, 2).unwrap();
        let without = auto_supports(&m, &params(0.0), &AUTO, &[], 1).unwrap();
        assert_eq!(with.supports[0].source, "manual");
        assert!(with.stats.added <= without.stats.added);
    }

    #[test]
    fn bake_adds_geometry_and_sits_on_the_plate() {
        let m = mushroom();
        let r = auto_supports(&m, &params(0.0), &AUTO, &[], 1).unwrap();
        let baked = bake(&m, &r.supports, &params(0.0)).unwrap();
        assert!(baked.tris.len() > m.tris.len());
        let (lo, _) = baked.bbox().unwrap();
        assert!(lo[2].abs() < 1e-9, "raft rests on z=0, got {}", lo[2]);
    }

    #[test]
    fn tilt_ranking_prefers_fewer_overhangs() {
        let rows = rank_tilts(&mushroom(), 0.0, 60.0, 15.0, 45.0, 3.0);
        assert_eq!(rows.len(), 5);
        assert!(rows[0].overhang <= rows.last().unwrap().overhang);
    }

    #[test]
    fn tilt_keeps_the_model_in_the_frame() {
        let (zoff, f) = frame(&mushroom(), &params(30.0)).unwrap();
        assert!(zoff.is_finite() && f.fits);
    }
}
