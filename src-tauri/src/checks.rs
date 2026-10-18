//! Slower geometric print checks (thin walls, narrow gaps, self-intersections,
//! casting fill). They are samples and screens, not proofs.

use openrscad_geom::Mesh;
use serde::Deserialize;

use crate::bvh::{Bvh, V3, shares_vertex};
use crate::meshtools::Finding;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckOptions {
    /// Thinner walls are reported, mm.
    pub min_wall: f64,
    /// Narrower gaps are reported, mm.
    pub min_gap: f64,
    /// The piece is a casting master: adds the casting-only checks (trapped cavities, heavy sections).
    #[serde(default)]
    pub casting: bool,
}

const SAMPLES: usize = 600;
const SELFINT_MAX_TRIS: usize = 100_000;
const FILL_THIN: f64 = 0.7;
const FILL_FEED: f64 = 2.0;
const FILL_REACH: f64 = 8.0;
const MAX_LOCATIONS: usize = 8;
/// Solid sections thicker than this (mm) shrink as they cool and leave porosity.
const HEAVY_SECTION: f64 = 3.5;
/// Cavities smaller than this (mm³) are numerical noise.
const MIN_CAVITY: f64 = 0.05;
/// Share of sampled surface that has to be heavy before it is reported.
const HEAVY_SHARE: f64 = 0.08;

fn sub(a: V3, b: V3) -> V3 {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn dist(a: V3, b: V3) -> f64 {
    let d = sub(a, b);
    (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt()
}

struct Sample {
    centre: V3,
    normal: V3,
    tri: usize,
    area: f64,
}

fn samples(m: &Mesh) -> Vec<Sample> {
    let stride = (m.tris.len() / SAMPLES).max(1);
    (0..m.tris.len())
        .step_by(stride)
        .filter_map(|t| {
            let [a, b, c] = m.tris[t].map(|i| m.verts[i as usize]);
            let (e1, e2) = (sub(b, a), sub(c, a));
            let n = [
                e1[1] * e2[2] - e1[2] * e2[1],
                e1[2] * e2[0] - e1[0] * e2[2],
                e1[0] * e2[1] - e1[1] * e2[0],
            ];
            let l = (n[0] * n[0] + n[1] * n[1] + n[2] * n[2]).sqrt();
            (l > 1e-9).then(|| Sample {
                centre: [
                    (a[0] + b[0] + c[0]) / 3.0,
                    (a[1] + b[1] + c[1]) / 3.0,
                    (a[2] + b[2] + c[2]) / 3.0,
                ],
                normal: n.map(|x| x / l),
                tri: t,
                area: l / 2.0 * stride as f64,
            })
        })
        .collect()
}

/// Groups spots into ~2 mm regions, worst (smallest value) first.
/// Returns (region count, region seeds with their value, total area).
fn cluster(mut spots: Vec<(f64, V3, f64)>) -> (usize, Vec<(f64, V3)>, f64) {
    spots.sort_by(|a, b| a.0.total_cmp(&b.0));
    let area: f64 = spots.iter().map(|s| s.2).sum();
    let mut seeds: Vec<(f64, V3)> = Vec::new();
    for (v, p, _) in spots {
        if !seeds.iter().any(|(_, q)| dist(p, *q) < 2.0) {
            seeds.push((v, p));
        }
    }
    (seeds.len(), seeds, area)
}

fn finding(level: &'static str, code: &'static str, detail: String, at: &[(f64, V3)]) -> Finding {
    Finding {
        level,
        code,
        detail,
        at: at.iter().take(MAX_LOCATIONS).map(|(_, p)| *p).collect(),
    }
}

/// Runs the checks on a watertight mesh with outward normals.
pub fn deep_checks(mesh: &Mesh, o: &CheckOptions) -> Vec<Finding> {
    let mut out = Vec::new();
    let mut m = mesh.welded(1e-4);
    if m.signed_volume() < 0.0 {
        m.flip_winding();
    }
    if m.tris.is_empty() {
        return out;
    }
    let bvh = Bvh::new(&m);
    let s = samples(&m);

    // thin walls: a ray inwards that leaves the piece within min_wall
    let mut thin = Vec::new();
    // narrow gaps: a ray outwards that meets another surface within min_gap
    let mut gaps = Vec::new();
    for sm in &s {
        let inward = sm.normal.map(|x| -x);
        if let Some(w) = bvh.ray(sm.centre, inward, Some(sm.tri), false, o.min_wall) {
            thin.push((w, sm.centre, sm.area));
        }
        if let Some(g) = bvh.ray(sm.centre, sm.normal, Some(sm.tri), true, o.min_gap) {
            gaps.push((g, sm.centre, sm.area));
        }
    }
    if thin.is_empty() {
        out.push(finding("pass", "noThin", format!("{:.2}", o.min_wall), &[]));
    } else {
        let min = thin.iter().map(|t| t.0).fold(f64::MAX, f64::min);
        let (n, seeds, area) = cluster(thin);
        out.push(finding(
            "warn",
            "thin",
            format!("{n}|{min:.3}|{area:.1}|{:.2}", o.min_wall),
            &seeds,
        ));
    }
    if gaps.is_empty() {
        out.push(finding("pass", "noGaps", format!("{:.2}", o.min_gap), &[]));
    } else {
        let min = gaps.iter().map(|t| t.0).fold(f64::MAX, f64::min);
        let (n, seeds, area) = cluster(gaps);
        out.push(finding(
            "warn",
            "gaps",
            format!("{n}|{min:.3}|{area:.1}|{:.2}", o.min_gap),
            &seeds,
        ));
    }

    // self-intersections
    if m.tris.len() > SELFINT_MAX_TRIS {
        out.push(finding(
            "info",
            "selfIntSkipped",
            m.tris.len().to_string(),
            &[],
        ));
    } else {
        let mut hits: Vec<(f64, V3)> = Vec::new();
        let mut near = Vec::new();
        let mut count = 0usize;
        for i in 0..m.tris.len() {
            let [a, b, c] = m.tris[i].map(|k| m.verts[k as usize]);
            let mut lo = a;
            let mut hi = a;
            for p in [b, c] {
                for k in 0..3 {
                    lo[k] = lo[k].min(p[k]);
                    hi[k] = hi[k].max(p[k]);
                }
            }
            bvh.overlapping(lo, hi, &mut near);
            for &j in &near {
                if j <= i || shares_vertex(&m, i, j) {
                    continue;
                }
                if crosses(&m, i, j) {
                    count += 1;
                    if hits.len() < MAX_LOCATIONS {
                        hits.push((
                            0.0,
                            [
                                (a[0] + b[0] + c[0]) / 3.0,
                                (a[1] + b[1] + c[1]) / 3.0,
                                (a[2] + b[2] + c[2]) / 3.0,
                            ],
                        ));
                    }
                }
            }
        }
        if count == 0 {
            out.push(finding("pass", "noSelfInt", String::new(), &[]));
        } else {
            out.push(finding("warn", "selfInt", count.to_string(), &hits));
        }
    }

    // casting fill: thin sections far from any thick mass
    let mut thick: Vec<V3> = Vec::new();
    let mut thin_pts: Vec<(f64, V3)> = Vec::new();
    for sm in &s {
        match bvh.ray(
            sm.centre,
            sm.normal.map(|x| -x),
            Some(sm.tri),
            false,
            FILL_FEED,
        ) {
            None => thick.push(sm.centre),
            Some(w) if w < FILL_THIN => thin_pts.push((w, sm.centre)),
            _ => {}
        }
    }
    if thick.is_empty() {
        out.push(finding(
            "info",
            "fillNoFeed",
            format!("{FILL_FEED:.1}"),
            &[],
        ));
    } else {
        let mut far: Vec<(f64, V3, f64)> = thin_pts
            .iter()
            .filter_map(|&(w, p)| {
                let d = thick.iter().map(|&q| dist(p, q)).fold(f64::MAX, f64::min);
                (d > FILL_REACH).then_some((-d, p, w))
            })
            .collect();
        if far.is_empty() {
            out.push(finding("pass", "fillOk", String::new(), &[]));
        } else {
            let worst = -far.iter().map(|f| f.0).fold(f64::MAX, f64::min);
            far.sort_by(|a, b| a.0.total_cmp(&b.0));
            let seeds: Vec<(f64, V3)> = far.iter().map(|f| (f.0, f.1)).collect();
            let (_, seeds, _) = cluster(seeds.iter().map(|&(v, p)| (v, p, 0.0)).collect());
            out.push(finding(
                "warn",
                "fill",
                format!("{worst:.0}|{FILL_REACH:.0}"),
                &seeds,
            ));
        }
    }
    if o.casting {
        casting_checks(&m, &bvh, &s, &mut out);
    }
    out
}

/// Checks that only matter when the piece is cast: closed cavities trap air and investment, and
/// thick solid sections freeze last and pull porosity into the metal.
fn casting_checks(m: &Mesh, bvh: &Bvh, s: &[Sample], out: &mut Vec<Finding>) {
    // closed cavities: connected shells whose volume is negative (they face inwards)
    let mut parent: Vec<usize> = (0..m.verts.len()).collect();
    fn find(p: &mut [usize], mut i: usize) -> usize {
        while p[i] != i {
            p[i] = p[p[i]];
            i = p[i];
        }
        i
    }
    for t in &m.tris {
        let (a, b, c) = (t[0] as usize, t[1] as usize, t[2] as usize);
        let (ra, rb) = (find(&mut parent, a), find(&mut parent, b));
        parent[ra] = rb;
        let (rb, rc) = (find(&mut parent, b), find(&mut parent, c));
        parent[rb] = rc;
    }
    let mut vol: std::collections::HashMap<usize, (f64, V3, usize)> = Default::default();
    for t in &m.tris {
        let [a, b, c] = t.map(|i| m.verts[i as usize]);
        let v = (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0]))
            / 6.0;
        let root = find(&mut parent, t[0] as usize);
        let e = vol.entry(root).or_insert((0.0, [0.0; 3], 0));
        e.0 += v;
        for k in 0..3 {
            e.1[k] += (a[k] + b[k] + c[k]) / 3.0;
        }
        e.2 += 1;
    }
    let mut cavities: Vec<(f64, V3)> = vol
        .values()
        .filter(|(v, _, _)| *v < -MIN_CAVITY)
        .map(|(v, sum, n)| (*v, sum.map(|x| x / *n as f64)))
        .collect();
    if cavities.is_empty() {
        out.push(finding("pass", "noCavity", String::new(), &[]));
    } else {
        cavities.sort_by(|a, b| a.0.total_cmp(&b.0));
        let total: f64 = cavities.iter().map(|c| -c.0).sum();
        out.push(finding(
            "warn",
            "cavity",
            format!("{}|{total:.2}", cavities.len()),
            &cavities,
        ));
    }

    // heavy sections: surface whose inward ray travels a long way without leaving the metal
    let heavy: Vec<(f64, V3, f64)> = s
        .iter()
        .filter(|sm| {
            bvh.ray(sm.centre, sm.normal.map(|x| -x), Some(sm.tri), false, HEAVY_SECTION).is_none()
        })
        .map(|sm| (0.0, sm.centre, sm.area))
        .collect();
    if (heavy.len() as f64) < HEAVY_SHARE * s.len() as f64 {
        out.push(finding("pass", "noHeavy", format!("{HEAVY_SECTION:.1}"), &[]));
    } else {
        let (n, seeds, area) = cluster(heavy);
        out.push(finding(
            "warn",
            "heavy",
            format!("{n}|{area:.0}|{HEAVY_SECTION:.1}"),
            &seeds,
        ));
    }
}

/// Do triangles `i` and `j` pierce each other (an edge of one passes through the other)?
fn crosses(m: &Mesh, i: usize, j: usize) -> bool {
    let pierces = |a: usize, b: usize| {
        let [p, q, r] = m.tris[a].map(|k| m.verts[k as usize]);
        let [x, y, z] = m.tris[b].map(|k| m.verts[k as usize]);
        [(p, q), (q, r), (r, p)].iter().any(|&(s, e)| {
            let d = sub(e, s);
            let l = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt();
            if l < 1e-9 {
                return false;
            }
            let u = d.map(|v| v / l);
            crate::bvh::moller(s, u, x, y, z).is_some_and(|t| t > 1e-3 && t < l - 1e-3)
        })
    };
    pierces(i, j) || pierces(j, i)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn boxm(lo: V3, hi: V3) -> Mesh {
        let v = vec![
            [lo[0], lo[1], lo[2]],
            [hi[0], lo[1], lo[2]],
            [hi[0], hi[1], lo[2]],
            [lo[0], hi[1], lo[2]],
            [lo[0], lo[1], hi[2]],
            [hi[0], lo[1], hi[2]],
            [hi[0], hi[1], hi[2]],
            [lo[0], hi[1], hi[2]],
        ];
        let t = vec![
            [0, 2, 1],
            [0, 3, 2],
            [4, 5, 6],
            [4, 6, 7],
            [0, 1, 5],
            [0, 5, 4],
            [1, 2, 6],
            [1, 6, 5],
            [2, 3, 7],
            [2, 7, 6],
            [3, 0, 4],
            [3, 4, 7],
        ];
        Mesh { verts: v, tris: t }
    }

    const OPT: CheckOptions = CheckOptions {
        min_wall: 0.5,
        min_gap: 0.3,
        casting: false,
    };
    const CAST: CheckOptions = CheckOptions {
        casting: true,
        ..OPT
    };

    #[test]
    fn thick_block_is_fine() {
        let f = deep_checks(&boxm([0.; 3], [10.; 3]), &OPT);
        assert!(f.iter().all(|f| f.level != "warn"), "{f:?}");
    }

    #[test]
    fn thin_plate_is_flagged() {
        let f = deep_checks(&boxm([0., 0., 0.], [10., 10., 0.3]), &OPT);
        assert!(
            f.iter().any(|f| f.code == "thin" && !f.at.is_empty()),
            "{f:?}"
        );
    }

    #[test]
    fn narrow_gap_is_flagged() {
        let mut a = boxm([0.; 3], [5.; 3]);
        let b = boxm([5.1, 0., 0.], [10., 5., 5.]);
        let off = a.verts.len() as u32;
        a.verts.extend(b.verts);
        a.tris
            .extend(b.tris.into_iter().map(|t| t.map(|i| i + off)));
        let f = deep_checks(&a, &OPT);
        assert!(f.iter().any(|f| f.code == "gaps"), "{f:?}");
    }

    #[test]
    fn overlapping_blocks_self_intersect() {
        let mut a = boxm([0.; 3], [5.; 3]);
        let b = boxm([2.5, 2.5, 2.5], [8., 8., 8.]);
        let off = a.verts.len() as u32;
        a.verts.extend(b.verts);
        a.tris
            .extend(b.tris.into_iter().map(|t| t.map(|i| i + off)));
        let f = deep_checks(&a, &OPT);
        assert!(f.iter().any(|f| f.code == "selfInt"), "{f:?}");
    }

    #[test]
    fn closed_cavity_is_flagged_for_casting() {
        let mut a = boxm([0.; 3], [10.; 3]);
        let mut b = boxm([3.; 3], [7.; 3]);
        b.flip_winding();
        let off = a.verts.len() as u32;
        a.verts.extend(b.verts);
        a.tris
            .extend(b.tris.into_iter().map(|t| t.map(|i| i + off)));
        let f = deep_checks(&a, &CAST);
        assert!(f.iter().any(|f| f.code == "cavity" && !f.at.is_empty()), "{f:?}");
        assert!(deep_checks(&a, &OPT).iter().all(|f| f.code != "cavity"));
    }

    #[test]
    fn heavy_block_is_flagged_for_casting() {
        let f = deep_checks(&boxm([0.; 3], [10.; 3]), &CAST);
        assert!(f.iter().any(|f| f.code == "heavy"), "{f:?}");
    }
}
