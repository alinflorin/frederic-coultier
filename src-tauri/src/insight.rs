//! Analyses that say more than pass/fail: where a mesh is broken, how a ring fits its size, which
//! faces overhang, whether the sprue can feed the piece, and which statement of the source made a spot.
//! Like `checks`, these are samples and screens, not proofs.

use std::f64::consts::PI;
use std::time::{Duration, Instant};

use openrscad_eval::{NullResolver, eval_program_with_budget, register_system_fonts};
use openrscad_geom::{GeomCache, Mesh, render_cached_warns};
use openrscad_syntax::{Arg, Modifier, Param, Program, Spanned, Stmt};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::bvh::{Bvh, V3};
use crate::checks;
use crate::meshtools::{self, Finding, SprueSpec};
use crate::render::{Kernel, line_col};

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
                for k in 0..3 {
                    r.0[k] = (r.0[k] * r.1 + centre[k] * area) / w;
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

// --- from a spot on the surface back to the source ---

/// One statement of the source that has the spot on its surface.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceHit {
    /// Range in the source, in UTF-16 units (what the editor counts in).
    pub from: usize,
    pub to: usize,
    pub line: usize,
    pub column: usize,
    pub end_line: usize,
    /// The first line of the statement.
    pub text: String,
    /// 0 = a top-level statement; deeper ones are inside it.
    pub depth: usize,
    /// No statement inside this one has the spot on its surface: this is where it comes from.
    pub leaf: bool,
}

const MAX_PROBES: usize = 400;
const MAX_TIME: Duration = Duration::from_secs(25);
const EVAL_BUDGET: u64 = 200_000_000;
const STACK_BYTES: usize = 256 * 1024 * 1024;

type Node = Spanned<Stmt>;

/// A statement that makes geometry (as opposed to defining something).
fn is_geometry(s: &Stmt) -> bool {
    matches!(
        s,
        Stmt::ModuleCall { .. } | Stmt::For { .. } | Stmt::If { .. } | Stmt::Let { .. } | Stmt::Block(_)
    )
}

/// What encloses the statements of one level, besides the statements themselves.
#[derive(Clone)]
enum Wrap {
    Top,
    Call { modifier: Option<Modifier>, name: String, args: Vec<Arg> },
    /// The body of a user module: a copy of the module is defined under a new name and called instead.
    UserCall { modifier: Option<Modifier>, params: Vec<Param>, args: Vec<Arg>, children: Vec<Node> },
    For(Vec<(String, openrscad_syntax::Expr)>),
    Let(Vec<(String, openrscad_syntax::Expr)>),
    IfThen { cond: openrscad_syntax::Expr, els: Vec<Node> },
    IfElse { cond: openrscad_syntax::Expr, then: Vec<Node> },
    Block,
}

struct Level {
    /// The definitions and assignments next to the statements being probed.
    before: Vec<Node>,
    wrap: Wrap,
}

struct Locator<'a> {
    source: &'a str,
    point: V3,
    tol: f64,
    cache: GeomCache,
    probes: usize,
    started: Instant,
    truncated: bool,
    /// Every user module seen so far, to follow calls into their bodies.
    modules: Vec<(String, Vec<Param>, Vec<Node>)>,
    hits: Vec<SourceHit>,
}

impl Locator<'_> {
    /// The program that has only `chosen` at the innermost level, inside everything that encloses it.
    fn program(levels: &[Level], chosen: &Node) -> Program {
        let mut inner: Vec<Node> = vec![chosen.clone()];
        for (i, lv) in levels.iter().enumerate().rev() {
            let span = chosen.span.clone();
            let w = |node: Stmt| Spanned::new(node, span.clone());
            let mut body = lv.before.clone();
            body.extend(inner);
            inner = match &lv.wrap {
                Wrap::Top => body,
                Wrap::Call { modifier, name, args } => vec![w(Stmt::ModuleCall {
                    modifier: *modifier,
                    name: name.clone(),
                    args: args.clone(),
                    children: body,
                })],
                Wrap::UserCall { modifier, params, args, children } => {
                    let probe = format!("__fc_probe_{i}");
                    vec![
                        w(Stmt::ModuleDef { name: probe.clone(), params: params.clone(), body }),
                        w(Stmt::ModuleCall {
                            modifier: *modifier,
                            name: probe,
                            args: args.clone(),
                            children: children.clone(),
                        }),
                    ]
                }
                Wrap::For(b) => vec![w(Stmt::For { bindings: b.clone(), body })],
                Wrap::Let(b) => vec![w(Stmt::Let { bindings: b.clone(), body })],
                Wrap::IfThen { cond, els } => {
                    vec![w(Stmt::If { cond: cond.clone(), then: body, els: els.clone() })]
                }
                Wrap::IfElse { cond, then } => {
                    vec![w(Stmt::If { cond: cond.clone(), then: then.clone(), els: body })]
                }
                Wrap::Block => vec![w(Stmt::Block(body))],
            };
        }
        inner
    }

    fn mesh_of(&mut self, prog: &Program) -> Option<Mesh> {
        let out = eval_program_with_budget(prog, &NullResolver, ".", EVAL_BUDGET).ok()?;
        let (mesh, _) = render_cached_warns(&out.node, &Kernel::new(), &mut self.cache).ok()?;
        Some(mesh)
    }

    /// Is the spot on the surface of `mesh`?
    fn on_surface(&self, mesh: &Mesh) -> bool {
        if let Some((lo, hi)) = mesh.bbox()
            && (0..3).any(|k| self.point[k] < lo[k] - self.tol || self.point[k] > hi[k] + self.tol)
        {
            return false;
        }
        mesh.tris.iter().any(|t| {
            let [a, b, c] = t.map(|i| mesh.verts[i as usize]);
            dist(meshtools::closest_on_tri(self.point, a, b, c), self.point) <= self.tol
        })
    }

    fn describe(&self, n: &Node, depth: usize) -> SourceHit {
        let end = n.span.end.min(self.source.len());
        let (line, column) = line_col(self.source, n.span.start);
        let (end_line, _) = line_col(self.source, end);
        let u16_at = |b: usize| {
            let mut b = b.min(self.source.len());
            while !self.source.is_char_boundary(b) {
                b -= 1;
            }
            self.source[..b].encode_utf16().count()
        };
        let head = self.source[n.span.start.min(self.source.len())..end]
            .lines()
            .next()
            .unwrap_or("")
            .trim();
        SourceHit {
            from: u16_at(n.span.start),
            to: u16_at(end),
            line,
            column,
            end_line,
            text: head.chars().take(90).collect(),
            depth,
            leaf: true,
        }
    }

    /// Looks inside a statement that has the spot on its surface.
    fn descend(&mut self, levels: &mut Vec<Level>, s: &Node, depth: usize) {
        let mut go = |this: &mut Self, wrap: Wrap, body: &[Node]| {
            levels.push(Level { before: Vec::new(), wrap });
            this.walk_body(levels, body, depth + 1);
            levels.pop();
        };
        match &s.node {
            Stmt::ModuleCall { modifier, name, args, children } => {
                if let Some((_, params, body)) = self.modules.iter().rev().find(|m| &m.0 == name).cloned() {
                    let wrap = Wrap::UserCall {
                        modifier: *modifier,
                        params,
                        args: args.clone(),
                        children: children.clone(),
                    };
                    go(self, wrap, &body);
                } else if !children.is_empty() {
                    let wrap = Wrap::Call { modifier: *modifier, name: name.clone(), args: args.clone() };
                    go(self, wrap, children);
                }
            }
            Stmt::For { bindings, body } => go(self, Wrap::For(bindings.clone()), body),
            Stmt::Let { bindings, body } => go(self, Wrap::Let(bindings.clone()), body),
            Stmt::If { cond, then, els } => {
                go(self, Wrap::IfThen { cond: cond.clone(), els: els.clone() }, then);
                go(self, Wrap::IfElse { cond: cond.clone(), then: then.clone() }, els);
            }
            Stmt::Block(body) => go(self, Wrap::Block, body),
            _ => {}
        }
    }

    fn walk_body(&mut self, levels: &mut Vec<Level>, body: &[Node], depth: usize) {
        // definitions and assignments inside the body stay with every probe made in it
        let keep: Vec<Node> = body.iter().filter(|s| !is_geometry(&s.node)).cloned().collect();
        for s in &keep {
            if let Stmt::ModuleDef { name, params, body } = &s.node {
                self.modules.push((name.clone(), params.clone(), body.clone()));
            }
        }
        if let Some(last) = levels.last_mut() {
            last.before = keep;
        }
        for s in body.iter().filter(|s| is_geometry(&s.node)) {
            if matches!(&s.node, Stmt::ModuleCall { modifier: Some(Modifier::Disable), .. }) {
                continue;
            }
            if self.probes >= MAX_PROBES || self.started.elapsed() > MAX_TIME {
                self.truncated = true;
                return;
            }
            self.probes += 1;
            let prog = Self::program(levels, s);
            let Some(mesh) = self.mesh_of(&prog) else { continue };
            if !self.on_surface(&mesh) {
                continue;
            }
            let idx = self.hits.len();
            self.hits.push(self.describe(s, depth));
            self.descend(levels, s, depth);
            if self.hits.len() > idx + 1 {
                self.hits[idx].leaf = false;
            }
        }
    }
}

/// The statements of `source` that have `point` (model coordinates) on the surface they make by
/// themselves, outermost first. Each candidate is evaluated on its own inside the transforms around it.
pub fn locate(source: &str, point: V3, tol: f64) -> Result<(Vec<SourceHit>, bool), String> {
    let source = source.to_owned();
    let handle = std::thread::Builder::new()
        .stack_size(STACK_BYTES)
        .spawn(move || {
            if source.contains("text(") {
                register_system_fonts();
            }
            let prog = openrscad_syntax::parse(&source).map_err(|e| e.message)?;
            let mut loc = Locator {
                source: &source,
                point,
                tol,
                cache: GeomCache::new(),
                probes: 0,
                started: Instant::now(),
                truncated: false,
                modules: Vec::new(),
                hits: Vec::new(),
            };
            let mut levels = vec![Level { before: Vec::new(), wrap: Wrap::Top }];
            loc.walk_body(&mut levels, &prog, 0);
            Ok((loc.hits, loc.truncated))
        })
        .map_err(|e| e.to_string())?;
    handle
        .join()
        .unwrap_or_else(|_| Err("the renderer crashed on this model".into()))
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
    fn a_plain_block_is_not_a_ring() {
        assert!(ring_fit(&boxm([0.; 3], [10., 10., 3.])).is_none());
    }

    #[test]
    fn spot_is_traced_to_the_statement_that_made_it() {
        let src = "cube(10);\ntranslate([30,0,0]) cube(10);\n";
        let (hits, _) = locate(src, [30.0, 5.0, 5.0], 0.05).unwrap();
        let leaf = hits.iter().find(|h| h.leaf).expect("a leaf");
        assert_eq!(leaf.line, 2, "{hits:?}");
        let (hits, _) = locate(src, [10.0, 5.0, 5.0], 0.05).unwrap();
        assert_eq!(hits.iter().find(|h| h.leaf).unwrap().line, 1, "{hits:?}");
    }

    #[test]
    fn spot_is_followed_into_modules_and_children() {
        let src = "module post(h) { cylinder(h=h, r=2, $fn=24); cube([20,20,2]); }\ntranslate([0,0,5]) union() { post(10); }\n";
        // the top of the cylinder: z = 5 + 10 = 15
        let (hits, _) = locate(src, [0.0, 0.0, 15.0], 0.05).unwrap();
        let leaf = hits.iter().find(|h| h.leaf).expect("a leaf");
        assert!(leaf.text.starts_with("cylinder"), "{hits:?}");
        assert!(leaf.depth >= 2, "{hits:?}");
    }
}

#[cfg(test)]
mod sample_tests {
    use super::*;

    #[test]
    fn sample_ring_is_measured_and_traced() {
        let src = include_str!("../../src/sample.scad");
        let mesh = crate::render::render_plain(src.to_owned()).expect("renders").mesh;
        let r = ring_fit(&mesh).expect("the sample is a ring");
        eprintln!("ring: {r:?}");
        let ex = Extra { notes: "EU 54, 5 mm centre stone.".into(), tilt: 20.0, overhang_angle: 45.0, sprue: Some(SprueSpec { diameter: 2.0, length: 8.0, at: None }) };
        for f in extra_findings(&mesh, &ex) {
            eprintln!("{} {} {} {:?} {:?}", f.level, f.code, f.detail, f.at, f.data);
        }
        let h = health(&mesh);
        eprintln!("health: open {} nm {} wind {} deg {}", h.open.len(), h.non_manifold.len(), h.winding.len(), h.degenerate.len());
        let (lo, hi) = mesh.bbox().unwrap();
        // the outside of the band, halfway along it
        let (hits, trunc) = locate(src, [hi[0], (lo[1] + hi[1]) / 2.0, (lo[2] + hi[2]) / 2.0], 0.05).unwrap();
        eprintln!("locate (truncated {trunc}):");
        for h in &hits {
            eprintln!("  d{} L{} leaf={} {}", h.depth, h.line, h.leaf, h.text);
        }
        let leaf = hits.iter().find(|h| h.leaf).expect("a leaf");
        assert!(leaf.text.starts_with("cylinder(d = ring_size_mm + 2"), "{hits:?}");
        // the bore is made by the other cylinder
        let (hits, _) = locate(src, [lo[0] + 1.6, (lo[1] + hi[1]) / 2.0, (lo[2] + hi[2]) / 2.0], 0.05).unwrap();
        let leaf = hits.iter().find(|h| h.leaf).expect("a leaf");
        assert!(leaf.text.starts_with("cylinder(d = ring_size_mm,"), "{hits:?}");
    }
}
