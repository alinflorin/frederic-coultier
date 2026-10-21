//! Analyses that say more than pass/fail: where a mesh is broken, how a ring fits its size, which
//! faces overhang, and whether the sprue can feed the piece.
//! Like `checks`, these are samples and screens, not proofs.

use std::f64::consts::PI;

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::bvh::{Bvh, V3};
use crate::checks;
use crate::meshtools::{self, Finding, SprueSpec};
use crate::mesh::Mesh;

fn sub(a: V3, b: V3) -> V3 {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn dot(a: V3, b: V3) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
fn dist(a: V3, b: V3) -> f64 {
    let d = sub(a, b);
    dot(d, d).sqrt()
}

// --- mesh health ---

/// Cap on the segments sent to the viewer per kind: a badly broken mesh must not flood the IPC.
const MAX_SEGMENTS: usize = 4000;
/// Triangles smaller than this (mm²) count as degenerate.
const TINY_AREA: f64 = 1e-8;
const WELD: f64 = 1e-4;

/// Where a mesh is broken, as geometry the viewer can draw (model coordinates).
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    /// Edges used by one triangle only: the borders of holes.
    pub open: Vec<[V3; 2]>,
    /// Edges shared by more than two triangles, or by two that run the same way.
    pub non_manifold: Vec<[V3; 2]>,
    /// Edges whose two triangles disagree on direction (flipped normals).
    pub winding: Vec<[V3; 2]>,
    /// Centres of zero-area triangles.
    pub degenerate: Vec<V3>,
    /// Some edges were left out because there were too many.
    pub truncated: bool,
}

pub fn health(mesh: &Mesh) -> Health {
    let m = mesh.welded(WELD);
    let mut h = Health::default();
    for t in &mesh.tris {
        let [a, b, c] = t.map(|i| mesh.verts[i as usize]);
        let n = [
            (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
            (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
            (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
        ];
        if dot(n, n).sqrt() / 2.0 < TINY_AREA {
            if h.degenerate.len() < MAX_SEGMENTS {
                h.degenerate.push([
                    (a[0] + b[0] + c[0]) / 3.0,
                    (a[1] + b[1] + c[1]) / 3.0,
                    (a[2] + b[2] + c[2]) / 3.0,
                ]);
            } else {
                h.truncated = true;
            }
        }
    }

    let mut directed: std::collections::HashMap<(u32, u32), u32> = Default::default();
    for t in &m.tris {
        for k in 0..3 {
            *directed.entry((t[k], t[(k + 1) % 3])).or_default() += 1;
        }
    }
    let push = |list: &mut Vec<[V3; 2]>, a: u32, b: u32, trunc: &mut bool| {
        if list.len() < MAX_SEGMENTS {
            list.push([m.verts[a as usize], m.verts[b as usize]]);
        } else {
            *trunc = true;
        }
    };
    // same classification as `meshtools::analyze`, so the counts agree with the numbers shown
    for (&(a, b), &n) in &directed {
        let back = directed.get(&(b, a)).copied().unwrap_or(0);
        if a > b && back > 0 {
            continue;
        }
        let mut trunc = false;
        match (n, back) {
            (1, 0) | (0, 1) => push(&mut h.open, a, b, &mut trunc),
            (1, 1) => {}
            (2, 0) | (0, 2) => push(&mut h.winding, a, b, &mut trunc),
            _ => push(&mut h.non_manifold, a, b, &mut trunc),
        }
        h.truncated |= trunc;
    }
    h
}

// --- ring fit ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RingFit {
    /// The axis through the finger: "x", "y" or "z".
    pub axis: &'static str,
    /// Typical inner diameter, mm (median of the chords through the bore).
    pub inner_diameter: f64,
    pub min_diameter: f64,
    pub max_diameter: f64,
    pub outer_diameter: f64,
    /// Along the finger, mm.
    pub width: f64,
    /// EU / ISO ring size: the inner circumference in mm.
    pub eu: f64,
    pub us: f64,
}

const RAYS: usize = 90;

/// Measures the bore of a ring: the smallest side of the bounding box is taken as the finger axis,
/// and chords are cast through its middle. `None` when the piece does not look like a ring.
pub fn ring_fit(mesh: &Mesh) -> Option<RingFit> {
    let (lo, hi) = mesh.bbox()?;
    let size = sub(hi, lo);
    let axis = (0..3).min_by(|&a, &b| size[a].total_cmp(&size[b]))?;
    let (u, v) = ((axis + 1) % 3, (axis + 2) % 3);
    let (big, small) = (size[u].max(size[v]), size[u].min(size[v]));
    if small < 1.0 || big / small > 1.6 || size[axis] < 0.5 {
        return None;
    }
    let bvh = Bvh::new(mesh);
    let mut centre = [(lo[u] + hi[u]) / 2.0, (lo[v] + hi[v]) / 2.0];
    let reach = big * 1.5;
    let mut chords: Vec<f64> = Vec::new();
    for pass in 0..3 {
        let mut hits: Vec<[f64; 2]> = Vec::new();
        chords.clear();
        // several heights along the finger: stones and prongs poke into the bore at some of them
        for frac in [0.5, 0.35, 0.65] {
            let mut o = [0.0; 3];
            o[axis] = lo[axis] + size[axis] * frac;
            o[u] = centre[0];
            o[v] = centre[1];
            let mut ring = vec![None; RAYS];
            for (i, slot) in ring.iter_mut().enumerate() {
                let a = 2.0 * PI * i as f64 / RAYS as f64;
                let mut d = [0.0; 3];
                d[u] = a.cos();
                d[v] = a.sin();
                *slot = bvh.ray(o, d, None, false, reach);
            }
            if frac == 0.5 {
                // a bore is open along the finger; a solid block is not
                let (mut up, mut down) = ([0.0; 3], [0.0; 3]);
                up[axis] = 1.0;
                down[axis] = -1.0;
                if bvh.ray(o, up, None, false, size[axis] * 4.0).is_some()
                    || bvh.ray(o, down, None, false, size[axis] * 4.0).is_some()
                {
                    return None;
                }
            }
            let found = ring.iter().flatten().count();
            if found < RAYS * 7 / 10 {
                if frac == 0.5 {
                    return None; // the middle is solid or open: no bore here
                }
                continue;
            }
            for i in 0..RAYS / 2 {
                if let (Some(a), Some(b)) = (ring[i], ring[i + RAYS / 2]) {
                    chords.push(a + b);
                }
            }
            if frac == 0.5 && pass < 2 {
                for (i, r) in ring.iter().enumerate() {
                    if let Some(r) = r {
                        let a = 2.0 * PI * i as f64 / RAYS as f64;
                        hits.push([centre[0] + r * a.cos(), centre[1] + r * a.sin()]);
                    }
                }
            }
        }
        if hits.is_empty() {
            break;
        }
        centre = [
            hits.iter().map(|h| h[0]).sum::<f64>() / hits.len() as f64,
            hits.iter().map(|h| h[1]).sum::<f64>() / hits.len() as f64,
        ];
    }
    if chords.is_empty() {
        return None;
    }
    chords.sort_by(f64::total_cmp);
    let inner = chords[chords.len() / 2];
    Some(RingFit {
        axis: ["x", "y", "z"][axis],
        inner_diameter: inner,
        min_diameter: chords[0],
        max_diameter: chords[chords.len() - 1],
        outer_diameter: big,
        width: size[axis],
        eu: inner * PI,
        us: (inner - 11.63) / 0.8128,
    })
}

/// A number right after `key`, allowing `:`, `=`, spaces and the word "size" in between.
fn number_after(text: &str, key: &str) -> Option<f64> {
    let mut from = 0;
    while let Some(i) = text[from..].find(key) {
        let at = from + i;
        from = at + key.len();
        // `eu` inside a longer word ("queue") is not a size
        if text[..at].chars().next_back().is_some_and(char::is_alphanumeric) {
            continue;
        }
        let mut rest = text[at + key.len()..].trim_start_matches([' ', ':', '=', '\t', '-']);
        if let Some(r) = rest.strip_prefix("size") {
            rest = r.trim_start_matches([' ', ':', '=', '\t']);
        }
        let digits: String = rest
            .chars()
            .take_while(|c| c.is_ascii_digit() || *c == '.' || *c == ',')
            .collect();
        if let Ok(n) = digits.replace(',', ".").trim_end_matches('.').parse::<f64>() {
            return Some(n);
        }
    }
    None
}

/// The finger size the user wrote in the notes ("EU 54", "US 7", "inner diameter 17.2 mm"):
/// the inner diameter in mm and how it was written.
pub fn ring_target(notes: &str) -> Option<(f64, String)> {
    let t = notes.to_lowercase();
    if let Some(n) = number_after(&t, "eu").or_else(|| number_after(&t, "iso")) {
        return Some((n / PI, format!("EU {n}")));
    }
    if let Some(n) = number_after(&t, "us") {
        return Some((11.63 + 0.8128 * n, format!("US {n}")));
    }
    for key in ["inner diameter", "inside diameter", "ø", "⌀"] {
        if let Some(n) = number_after(&t, key) {
            return Some((n, format!("{n} mm")));
        }
    }
    None
}

// --- overhang ---

/// Faces within `angle` degrees of a horizontal ceiling, when the piece is printed tilted by `tilt` about X
/// (the same rule as the automatic supports and the tilt ranking).
pub fn overhang(mesh: &Mesh, tilt: f64, angle: f64) -> (f64, f64, Vec<(V3, f64, f64)>) {
    let (s, c) = (tilt * PI / 180.0).sin_cos();
    let up = [0.0, s, c];
    let limit = (angle * PI / 180.0).cos();
    let (mut over, mut total) = (0.0, 0.0);
    // regions: centre (area-weighted), area, flattest slope seen
    let mut regions: Vec<(V3, f64, f64)> = Vec::new();
    for t in &mesh.tris {
        let [a, b, cc] = t.map(|i| mesh.verts[i as usize]);
        let (e1, e2) = (sub(b, a), sub(cc, a));
        let n = [
            e1[1] * e2[2] - e1[2] * e2[1],
            e1[2] * e2[0] - e1[0] * e2[2],
            e1[0] * e2[1] - e1[1] * e2[0],
        ];
        let l = dot(n, n).sqrt();
        if l < 1e-12 {
            continue;
        }
        let area = l / 2.0;
        total += area;
        let nz = dot(n, up) / l;
        if nz >= -limit {
            continue;
        }
        over += area;
        let centre = [
            (a[0] + b[0] + cc[0]) / 3.0,
            (a[1] + b[1] + cc[1]) / 3.0,
            (a[2] + b[2] + cc[2]) / 3.0,
        ];
        let slope = (-nz).clamp(-1.0, 1.0).acos().to_degrees();
        match regions.iter_mut().find(|r| dist(r.0, centre) < 2.5) {
            Some(r) => {
                let w = r.1 + area;
                for (rk, ck) in r.0.iter_mut().zip(centre) {
                    *rk = (*rk * r.1 + ck * area) / w;
                }
                r.1 = w;
                r.2 = r.2.min(slope);
            }
            None => regions.push((centre, area, slope)),
        }
    }
    regions.sort_by(|a, b| b.1.total_cmp(&a.1));
    (over, total, regions)
}

// --- one spot ---

/// What the surface is like at (the nearest point to) a spot.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotProbe {
    /// The point of the surface nearest to the one asked for.
    pub surface: V3,
    /// How far the asked-for point was from the surface, mm.
    pub off_by: f64,
    pub normal: V3,
    /// Metal straight in from the surface to where it leaves the piece; `None` when it never does.
    pub thickness: Option<f64>,
    /// Degrees between the surface normal and the build direction: 0 faces up, 90 is a wall, 180 a ceiling.
    pub incline: f64,
}

/// Wall thickness and slope at the surface point nearest to `point`, for a piece printed tilted by `tilt`.
pub fn probe(mesh: &Mesh, point: V3, tilt: f64) -> Option<SpotProbe> {
    let m = mesh.welded(WELD);
    let mut best: Option<(f64, V3, usize)> = None;
    for (i, t) in m.tris.iter().enumerate() {
        let [a, b, c] = t.map(|k| m.verts[k as usize]);
        let q = meshtools::closest_on_tri(point, a, b, c);
        let d = dist(q, point);
        if best.is_none_or(|x| d < x.0) {
            best = Some((d, q, i));
        }
    }
    let (off_by, surface, tri) = best?;
    let [a, b, c] = m.tris[tri].map(|k| m.verts[k as usize]);
    let (e1, e2) = (sub(b, a), sub(c, a));
    let mut n = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0],
    ];
    let l = dot(n, n).sqrt();
    if l < 1e-12 {
        return None;
    }
    n = n.map(|x| x / l);
    // the winding may point inwards (a mesh that is inside-out): make the normal face outwards
    let mut w = m.clone();
    if w.signed_volume() < 0.0 {
        w.flip_winding();
        n = n.map(|x| -x);
    }
    let bvh = Bvh::new(&w);
    let thickness = bvh.ray(surface, n.map(|x| -x), Some(tri), false, 500.0);
    let (s, cs) = (tilt * PI / 180.0).sin_cos();
    let up = [0.0, s, cs];
    Some(SpotProbe {
        surface,
        off_by,
        normal: n,
        thickness,
        incline: dot(n, up).clamp(-1.0, 1.0).acos().to_degrees(),
    })
}

// --- the extra findings of a report ---

/// What the report needs besides the geometry.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Extra {
    /// The project notes, where the ring size may be written.
    #[serde(default)]
    pub notes: String,
    pub tilt: f64,
    /// Faces within this many degrees of a ceiling need support.
    pub overhang_angle: f64,
    #[serde(default)]
    pub sprue: Option<SprueSpec>,
}

fn with_data(mut f: Finding, data: serde_json::Value) -> Finding {
    f.data = Some(data);
    f
}

fn round(x: f64, places: i32) -> f64 {
    let k = 10f64.powi(places);
    (x * k).round() / k
}

pub fn extra_findings(mesh: &Mesh, o: &Extra) -> Vec<Finding> {
    let mut out = Vec::new();
    let m = mesh.welded(WELD);
    if m.tris.is_empty() {
        return out;
    }

    // overall size against the ring size the user asked for
    if let Some(r) = ring_fit(&m) {
        let mut f = Finding::new(
            "info",
            "ringFit",
            format!(
                "{:.2}|{:.1}|{:.1}|{:.2}|{:.2}",
                r.inner_diameter, r.eu, r.us, r.outer_diameter, r.width
            ),
        );
        f = with_data(
            f,
            json!({
                "axis": r.axis,
                "innerDiameterMm": round(r.inner_diameter, 2),
                "innerDiameterRangeMm": [round(r.min_diameter, 2), round(r.max_diameter, 2)],
                "outerDiameterMm": round(r.outer_diameter, 2),
                "bandWidthMm": round(r.width, 2),
                "euSize": round(r.eu, 1),
                "usSize": round(r.us, 1),
            }),
        );
        out.push(f);
        if let Some((want, label)) = ring_target(&o.notes) {
            let delta = r.inner_diameter - want;
            let ok = delta.abs() <= 0.15;
            let f = Finding::new(
                if ok { "pass" } else { "warn" },
                if ok { "ringTargetOk" } else { "ringTarget" },
                format!("{want:.2}|{:.2}|{delta:+.2}|{label}", r.inner_diameter),
            );
            out.push(with_data(
                f,
                json!({
                    "wanted": label,
                    "wantedInnerDiameterMm": round(want, 2),
                    "measuredInnerDiameterMm": round(r.inner_diameter, 2),
                    "deltaMm": round(delta, 2),
                    "withinTolerance": ok,
                    "toleranceMm": 0.15,
                }),
            ));
        }
    }

    // overhang at the current print tilt
    let (over, total, regions) = overhang(&m, o.tilt, o.overhang_angle);
    if over <= 0.0 {
        out.push(Finding::new("pass", "noOverhang", format!("{:.0}", o.tilt)));
    } else {
        let share = over / total.max(1e-9) * 100.0;
        let mut f = Finding::new(
            "info",
            "overhang",
            format!("{over:.1}|{share:.0}|{}|{:.0}|{:.0}", regions.len(), o.overhang_angle, o.tilt),
        );
        f.at = regions.iter().take(8).map(|r| r.0).collect();
        f.vals = regions.iter().take(8).map(|r| round(r.1, 2)).collect();
        out.push(with_data(
            f,
            json!({
                "tiltDeg": o.tilt,
                "limitDegFromCeiling": o.overhang_angle,
                "overhangAreaMm2": round(over, 1),
                "sharePercent": round(share, 1),
                "regionCount": regions.len(),
                "regions": regions.iter().take(8).map(|r| json!({
                    "at": r.0.map(|x| round(x, 2)),
                    "areaMm2": round(r.1, 2),
                    "flattestSlopeDegFromCeiling": round(r.2, 1),
                })).collect::<Vec<_>>(),
            }),
        ));
    }

    if let Some(spec) = o.sprue {
        out.extend(sprue_findings(&m, &spec));
    }
    out
}

// --- sprue ---

/// Thin sections farther than this (mm) from the sprue foot may freeze before the metal reaches them.
const SPRUE_REACH: f64 = 14.0;
/// The sprue should be about as thick as the section it feeds.
const SPRUE_RATIO: (f64, f64) = (0.6, 1.5);

/// Can the sprue feed the piece? Where it joins (and how thick the metal is there), and which thin
/// sections lie far from its foot.
pub fn sprue_findings(m: &Mesh, spec: &SprueSpec) -> Vec<Finding> {
    let Some((_, thickness, at)) = meshtools::plan_sprue_at(m, spec) else {
        return vec![Finding::new("warn", "sprueNone", String::new())];
    };
    let mut out = Vec::new();
    let ratio = spec.diameter / thickness.max(1e-6);
    let good = (SPRUE_RATIO.0..=SPRUE_RATIO.1).contains(&ratio);
    let mut f = Finding::new(
        if good { "pass" } else { "warn" },
        if good { "sprueJoinOk" } else { "sprueJoin" },
        format!("{:.2}|{:.2}|{ratio:.2}", spec.diameter, thickness),
    );
    f.at = vec![at];
    out.push(with_data(
        f,
        json!({
            "at": at.map(|x| round(x, 2)),
            "sprueDiameterMm": spec.diameter,
            "metalThicknessAtJoinMm": round(thickness, 2),
            "ratio": round(ratio, 2),
            "goodRatioRange": [SPRUE_RATIO.0, SPRUE_RATIO.1],
        }),
    ));

    let bvh = Bvh::new(m);
    let mut far: Vec<(f64, V3)> = Vec::new();
    for s in checks::samples(m) {
        let wall = bvh.ray(s.centre, s.normal.map(|x| -x), Some(s.tri), false, checks::FILL_THIN);
        if wall.is_some() {
            let d = dist(s.centre, at);
            if d > SPRUE_REACH {
                far.push((d, s.centre));
            }
        }
    }
    if far.is_empty() {
        out.push(Finding::new("pass", "sprueReachOk", format!("{SPRUE_REACH:.0}")));
    } else {
        far.sort_by(|a, b| b.0.total_cmp(&a.0));
        let mut seeds: Vec<(f64, V3)> = Vec::new();
        for (d, p) in &far {
            if !seeds.iter().any(|(_, q)| dist(*p, *q) < 2.0) {
                seeds.push((*d, *p));
            }
        }
        let mut f = Finding::new(
            "warn",
            "sprueReach",
            format!("{}|{:.1}|{SPRUE_REACH:.0}", seeds.len(), seeds[0].0),
        );
        f.at = seeds.iter().take(8).map(|s| s.1).collect();
        f.vals = seeds.iter().take(8).map(|s| round(s.0, 1)).collect();
        out.push(with_data(
            f,
            json!({
                "regions": seeds.len(),
                "farthestMm": round(seeds[0].0, 1),
                "limitMm": SPRUE_REACH,
                "from": at.map(|x| round(x, 2)),
            }),
        ));
    }
    out
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

    #[test]
    fn closed_box_has_no_broken_edges() {
        let h = health(&boxm([0.; 3], [5.; 3]));
        assert!(h.open.is_empty() && h.non_manifold.is_empty() && h.winding.is_empty());
    }

    #[test]
    fn missing_triangle_leaves_an_open_border() {
        let mut m = boxm([0.; 3], [5.; 3]);
        m.tris.pop();
        let h = health(&m);
        assert_eq!(h.open.len(), 3, "{h:?}");
    }

    #[test]
    fn flipped_triangle_is_a_winding_fault() {
        let mut m = boxm([0.; 3], [5.; 3]);
        m.tris[0].swap(1, 2);
        let h = health(&m);
        assert!(!h.winding.is_empty() || !h.non_manifold.is_empty(), "{h:?}");
    }

    #[test]
    fn ring_sizes_are_read_from_notes() {
        let (d, _) = ring_target("EU 54, 5 mm centre stone.").unwrap();
        assert!((d - 54.0 / PI).abs() < 1e-9);
        let (d, _) = ring_target("size us 7.5 please").unwrap();
        assert!((d - (11.63 + 0.8128 * 7.5)).abs() < 1e-9);
        let (d, _) = ring_target("Inner diameter: 17,2 mm").unwrap();
        assert!((d - 17.2).abs() < 1e-9);
        assert!(ring_target("queue 12 of the budget").is_none());
        assert!(ring_target("").is_none());
    }

    #[test]
    fn ceiling_is_an_overhang_and_floor_is_not() {
        // a box printed upright: its underside (a ceiling facing the plate) overhangs only by the rule's angle
        let (over, total, regions) = overhang(&boxm([0.; 3], [10.; 3]), 0.0, 45.0);
        assert!((over - 100.0).abs() < 1e-6, "{over}");
        assert!((total - 600.0).abs() < 1e-6);
        assert!(!regions.is_empty());
    }

    /// A ring made of a square tube around the z axis, 17 mm inside diameter.
    fn tube_ring(inner: f64) -> Mesh {
        let n = 48;
        let (r0, r1, h) = (inner / 2.0, inner / 2.0 + 2.0, 4.0);
        let mut m = Mesh::new();
        for i in 0..n {
            let a = 2.0 * PI * i as f64 / n as f64;
            let (s, c) = a.sin_cos();
            for (r, z) in [(r0, 0.0), (r1, 0.0), (r1, h), (r0, h)] {
                m.verts.push([r * c, r * s, z]);
            }
        }
        for i in 0..n {
            let j = (i + 1) % n;
            for k in 0..4u32 {
                let l = (k + 1) % 4;
                let (a, b, c, d) = (4 * i as u32 + k, 4 * i as u32 + l, 4 * j as u32 + l, 4 * j as u32 + k);
                m.tris.push([a, b, c]);
                m.tris.push([a, c, d]);
            }
        }
        m
    }

    #[test]
    fn bore_of_a_ring_is_measured() {
        let r = ring_fit(&tube_ring(17.0)).expect("a ring");
        assert_eq!(r.axis, "z");
        assert!((r.inner_diameter - 17.0).abs() < 0.1, "{}", r.inner_diameter);
        assert!((r.eu - 17.0 * PI).abs() < 0.4);
    }

    #[test]
    fn spot_probe_reads_wall_and_slope() {
        let b = boxm([0.; 3], [10., 10., 3.]);
        // on the top face: 3 mm of metal, facing up
        let p = probe(&b, [5.0, 5.0, 3.2], 0.0).unwrap();
        assert!((p.thickness.unwrap() - 3.0).abs() < 1e-6, "{p:?}");
        assert!(p.incline < 1.0);
        assert!((p.off_by - 0.2).abs() < 1e-9);
        // on the underside: a ceiling
        let p = probe(&b, [5.0, 5.0, -0.1], 0.0).unwrap();
        assert!((p.incline - 180.0).abs() < 1.0, "{p:?}");
        // on a side wall: 10 mm of metal, upright
        let p = probe(&b, [10.1, 5.0, 1.5], 0.0).unwrap();
        assert!((p.thickness.unwrap() - 10.0).abs() < 1e-6 && (p.incline - 90.0).abs() < 1.0, "{p:?}");
    }

    #[test]
    fn a_plain_block_is_not_a_ring() {
        assert!(ring_fit(&boxm([0.; 3], [10., 10., 3.])).is_none());
    }
}
