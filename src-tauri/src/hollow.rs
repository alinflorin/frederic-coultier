//! Hollowing: carve a cavity that leaves a constant wall, then drill drain holes.
//!
//! The cavity is the set of points deeper than `wall` inside the piece, found
//! with a distance field on a voxel grid and meshed with naive surface nets.
//! Walls come out within about half a voxel of the requested thickness. Parts
//! thinner than twice the wall stay solid, so bails and prongs are untouched.

use std::collections::HashMap;

use openrscad_geom::{Kernel as KernelTrait, Mesh};
use serde::{Deserialize, Serialize};

use crate::bvh::{Bvh, V3};
use crate::meshtools::tube;
use crate::render::Kernel;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HollowSpec {
    /// Wall thickness, mm (at least 0.5).
    pub wall: f64,
    /// Drain hole diameter, mm.
    pub drain: f64,
    /// Print tilt about X, degrees: decides which cavity points are lowest and highest.
    pub tilt: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HollowReport {
    pub cavities: usize,
    pub drains: usize,
    /// Volume removed, mm³.
    pub removed: f64,
}

const MAX_VOXELS: f64 = 60e6;
/// Cavity regions narrower than this (full width, mm) are dropped.
const MIN_CAVITY: f64 = 0.5;

/// Unions meshes into one solid; falls back to plain concatenation if the
/// kernel rejects an operand (overlapping shells still print fine).
pub fn fuse(parts: Vec<Mesh>) -> Mesh {
    let parts: Vec<Mesh> = parts.into_iter().map(|p| p.welded(1e-6)).collect();
    match Kernel::new().union(parts.clone()) {
        Ok(m) if !m.is_empty() => m,
        _ => {
            let mut out = Mesh::new();
            for p in parts {
                let base = out.verts.len() as u32;
                out.verts.extend(p.verts);
                out.tris
                    .extend(p.tris.into_iter().map(|t| t.map(|i| i + base)));
            }
            out
        }
    }
}

struct Grid {
    lo: V3,
    h: f64,
    n: [usize; 3],
}

impl Grid {
    fn idx(&self, i: usize, j: usize, k: usize) -> usize {
        (i * self.n[1] + j) * self.n[2] + k
    }
    fn pos(&self, i: f64, j: f64, k: f64) -> V3 {
        [
            self.lo[0] + (i + 0.5) * self.h,
            self.lo[1] + (j + 0.5) * self.h,
            self.lo[2] + (k + 0.5) * self.h,
        ]
    }
}

fn make_grid(m: &Mesh, wall: f64) -> Option<Grid> {
    let (lo, hi) = m.bbox()?;
    let mut h = (wall / 5.0).clamp(0.08, 0.3);
    loop {
        let n = [0, 1, 2].map(|k| ((hi[k] - lo[k]) / h).ceil() as usize + 6);
        if (n[0] * n[1] * n[2]) as f64 <= MAX_VOXELS {
            return Some(Grid {
                lo: lo.map(|x| x - 3.0 * h),
                h,
                n,
            });
        }
        h *= 1.15;
    }
}

/// inside[idx] for every voxel centre, by counting surface crossings along z.
fn voxelize(m: &Mesh, g: &Grid) -> Vec<bool> {
    let [nx, ny, nz] = g.n;
    let mut cols: Vec<Vec<f64>> = vec![Vec::new(); nx * ny];
    // a tiny irrational offset keeps column centres off triangle edges
    let (jx, jy) = (1.234e-7, 2.718e-7);
    for t in &m.tris {
        let [a, b, c] = t.map(|i| m.verts[i as usize]);
        let (minx, maxx) = (a[0].min(b[0]).min(c[0]), a[0].max(b[0]).max(c[0]));
        let (miny, maxy) = (a[1].min(b[1]).min(c[1]), a[1].max(b[1]).max(c[1]));
        let det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if det.abs() < 1e-14 {
            continue; // vertical triangle: no crossing
        }
        let i0 = (((minx - g.lo[0]) / g.h - 0.5).floor().max(0.0)) as usize;
        let i1 = ((((maxx - g.lo[0]) / g.h - 0.5).ceil()).max(0.0) as usize).min(nx - 1);
        let j0 = (((miny - g.lo[1]) / g.h - 0.5).floor().max(0.0)) as usize;
        let j1 = ((((maxy - g.lo[1]) / g.h - 0.5).ceil()).max(0.0) as usize).min(ny - 1);
        for i in i0..=i1 {
            let x = g.lo[0] + (i as f64 + 0.5) * g.h + jx;
            for j in j0..=j1 {
                let y = g.lo[1] + (j as f64 + 0.5) * g.h + jy;
                let l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det;
                let l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det;
                let l3 = 1.0 - l1 - l2;
                if l1 >= 0.0 && l2 >= 0.0 && l3 >= 0.0 {
                    cols[i * ny + j].push(l1 * a[2] + l2 * b[2] + l3 * c[2]);
                }
            }
        }
    }
    let mut inside = vec![false; nx * ny * nz];
    for i in 0..nx {
        for j in 0..ny {
            let zs = &mut cols[i * ny + j];
            zs.sort_by(f64::total_cmp);
            for pair in zs.chunks_exact(2) {
                let k0 = ((pair[0] - g.lo[2]) / g.h - 0.5).ceil().max(0.0) as usize;
                let k1 = ((pair[1] - g.lo[2]) / g.h - 0.5).floor();
                if k1 < 0.0 {
                    continue;
                }
                for k in k0..=(k1 as usize).min(nz - 1) {
                    inside[g.idx(i, j, k)] = true;
                }
            }
        }
    }
    inside
}

/// One-dimensional squared Euclidean distance transform (Felzenszwalb–Huttenlocher).
fn edt_line(f: &[f32], d: &mut [f32], v: &mut [usize], z: &mut [f32]) {
    let n = f.len();
    let mut k = 0usize;
    v[0] = 0;
    z[0] = f32::NEG_INFINITY;
    z[1] = f32::INFINITY;
    for q in 1..n {
        let mut s;
        loop {
            let p = v[k];
            s = ((f[q] + (q * q) as f32) - (f[p] + (p * p) as f32)) / (2.0 * (q as f32 - p as f32));
            if s <= z[k] {
                k -= 1; // z[0] is -inf, so k never underflows
            } else {
                break;
            }
        }
        k += 1;
        v[k] = q;
        z[k] = s;
        z[k + 1] = f32::INFINITY;
    }
    let mut k = 0usize;
    for q in 0..n {
        while z[k + 1] < q as f32 {
            k += 1;
        }
        let p = v[k];
        d[q] = (q as f32 - p as f32).powi(2) + f[p];
    }
}

/// Squared distance (in voxels) from every voxel to the nearest outside voxel.
fn distance_to_outside(inside: &[bool], g: &Grid) -> Vec<f32> {
    let [nx, ny, nz] = g.n;
    const INF: f32 = 1e9;
    let mut f: Vec<f32> = inside.iter().map(|&i| if i { INF } else { 0.0 }).collect();
    let longest = nx.max(ny).max(nz);
    let (mut src, mut dst) = (vec![0f32; longest], vec![0f32; longest]);
    let (mut v, mut z) = (vec![0usize; longest], vec![0f32; longest + 1]);

    for axis in 0..3 {
        let (a, b, len) = match axis {
            0 => (ny, nz, nx),
            1 => (nx, nz, ny),
            _ => (nx, ny, nz),
        };
        for p in 0..a {
            for q in 0..b {
                let at = |t: usize| match axis {
                    0 => g.idx(t, p, q),
                    1 => g.idx(p, t, q),
                    _ => g.idx(p, q, t),
                };
                for t in 0..len {
                    src[t] = f[at(t)];
                }
                edt_line(
                    &src[..len],
                    &mut dst[..len],
                    &mut v[..len],
                    &mut z[..len + 1],
                );
                for t in 0..len {
                    f[at(t)] = dst[t];
                }
            }
        }
    }
    f
}

/// Positive inside the cavity. Returns None when there is nothing to hollow.
fn cavity_field(m: &Mesh, g: &Grid, wall: f64) -> Option<Vec<f32>> {
    let inside = voxelize(m, g);
    let d2 = distance_to_outside(&inside, g);
    let half = g.h / 2.0;
    let mut field: Vec<f32> = inside
        .iter()
        .zip(&d2)
        .map(|(&i, &d)| {
            if i {
                ((d as f64).sqrt() * g.h - half - wall) as f32
            } else {
                -(g.h as f32)
            }
        })
        .collect();

    // drop cavity regions that are too narrow to be worth it
    let [nx, ny, nz] = g.n;
    let mut label = vec![0u32; field.len()];
    let mut next = 1u32;
    let mut keep_any = false;
    let mut stack = Vec::new();
    for start in 0..field.len() {
        if field[start] <= 0.0 || label[start] != 0 {
            continue;
        }
        let mut cells = vec![start];
        let mut peak = 0f32;
        label[start] = next;
        stack.push(start);
        while let Some(c) = stack.pop() {
            peak = peak.max(field[c]);
            let (i, j, k) = (c / (ny * nz), (c / nz) % ny, c % nz);
            for (di, dj, dk) in [
                (1i32, 0i32, 0i32),
                (-1, 0, 0),
                (0, 1, 0),
                (0, -1, 0),
                (0, 0, 1),
                (0, 0, -1),
            ] {
                let (a, b, d) = (i as i32 + di, j as i32 + dj, k as i32 + dk);
                if a < 0 || b < 0 || d < 0 || a >= nx as i32 || b >= ny as i32 || d >= nz as i32 {
                    continue;
                }
                let n = g.idx(a as usize, b as usize, d as usize);
                if field[n] > 0.0 && label[n] == 0 {
                    label[n] = next;
                    cells.push(n);
                    stack.push(n);
                }
            }
        }
        if (peak as f64) < MIN_CAVITY / 2.0 {
            for c in cells {
                field[c] = -(g.h as f32);
            }
        } else {
            keep_any = true;
        }
        next += 1;
    }
    keep_any.then_some(field)
}

/// Naive surface nets over the zero level of `field`, normals pointing out of the positive region.
fn surface_nets(field: &[f32], g: &Grid) -> Mesh {
    let [nx, ny, nz] = g.n;
    let at = |i: usize, j: usize, k: usize| field[g.idx(i, j, k)] as f64;
    let mut cell_vertex: HashMap<usize, u32> = HashMap::new();
    let mut m = Mesh::new();

    for i in 0..nx - 1 {
        for j in 0..ny - 1 {
            for k in 0..nz - 1 {
                let mut vals = [0f64; 8];
                let mut pos = 0;
                for c in 0..8 {
                    vals[c] = at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1));
                    pos += (vals[c] > 0.0) as u8;
                }
                if pos == 0 || pos == 8 {
                    continue;
                }
                // mean of the edge crossings
                let (mut sum, mut cnt) = ([0.0; 3], 0.0);
                for (a, b) in EDGES {
                    let (va, vb) = (vals[a], vals[b]);
                    if (va > 0.0) != (vb > 0.0) {
                        let t = va / (va - vb);
                        for ax in 0..3 {
                            let (pa, pb) = (((a >> ax) & 1) as f64, ((b >> ax) & 1) as f64);
                            sum[ax] += pa + t * (pb - pa);
                        }
                        cnt += 1.0;
                    }
                }
                let p = g.pos(
                    i as f64 + sum[0] / cnt,
                    j as f64 + sum[1] / cnt,
                    k as f64 + sum[2] / cnt,
                );
                cell_vertex.insert(g.idx(i, j, k), m.verts.len() as u32);
                m.verts.push(p);
            }
        }
    }

    for i in 1..nx - 1 {
        for j in 1..ny - 1 {
            for k in 1..nz - 1 {
                let here = at(i, j, k) > 0.0;
                for axis in 0..3 {
                    let (ni, nj, nk) = match axis {
                        0 => (i + 1, j, k),
                        1 => (i, j + 1, k),
                        _ => (i, j, k + 1),
                    };
                    if (at(ni, nj, nk) > 0.0) == here {
                        continue;
                    }
                    // cells around the edge, looping in the (b, c) plane for axis a
                    let (b, c) = ((axis + 1) % 3, (axis + 2) % 3);
                    let base = [i, j, k];
                    let cell = |db: usize, dc: usize| {
                        let mut p = base;
                        p[b] -= 1 - db;
                        p[c] -= 1 - dc;
                        cell_vertex.get(&g.idx(p[0], p[1], p[2])).copied()
                    };
                    let (Some(q0), Some(q1), Some(q2), Some(q3)) =
                        (cell(0, 0), cell(1, 0), cell(1, 1), cell(0, 1))
                    else {
                        continue;
                    };
                    let (q1, q3) = if here { (q1, q3) } else { (q3, q1) };
                    m.tris.push([q0, q1, q2]);
                    m.tris.push([q0, q2, q3]);
                }
            }
        }
    }
    m
}

const EDGES: [(usize, usize); 12] = [
    (0, 1),
    (2, 3),
    (4, 5),
    (6, 7),
    (0, 2),
    (1, 3),
    (4, 6),
    (5, 7),
    (0, 4),
    (1, 5),
    (2, 6),
    (3, 7),
];

/// Connected pieces of a mesh, as lists of vertex indices.
fn components(m: &Mesh) -> Vec<Vec<u32>> {
    let mut parent: Vec<usize> = (0..m.verts.len()).collect();
    fn find(p: &mut [usize], mut a: usize) -> usize {
        while p[a] != a {
            p[a] = p[p[a]];
            a = p[a];
        }
        a
    }
    for t in &m.tris {
        for k in 1..3 {
            let (a, b) = (
                find(&mut parent, t[0] as usize),
                find(&mut parent, t[k] as usize),
            );
            if a != b {
                parent[a] = b;
            }
        }
    }
    let mut groups: HashMap<usize, Vec<u32>> = HashMap::new();
    let used: std::collections::HashSet<u32> = m.tris.iter().flatten().copied().collect();
    for v in used {
        groups
            .entry(find(&mut parent, v as usize))
            .or_default()
            .push(v);
    }
    groups.into_values().collect()
}

/// Hollows `mesh`. `Ok(None)` when the piece is too thin to hollow anywhere.
pub fn hollow(mesh: &Mesh, spec: &HollowSpec) -> Result<Option<(Mesh, HollowReport)>, String> {
    let mut outer = mesh.welded(1e-5);
    if outer.signed_volume() < 0.0 {
        outer.flip_winding();
    }
    let wall = spec.wall.max(0.5);
    let Some(g) = make_grid(&outer, wall) else {
        return Ok(None);
    };
    let Some(field) = cavity_field(&outer, &g, wall) else {
        return Ok(None);
    };
    let cavity = surface_nets(&field, &g);
    if cavity.tris.is_empty() {
        return Ok(None);
    }

    // drain holes: through the lowest and highest point of every cavity in the print orientation
    let (s, c) = (spec.tilt.to_radians().sin(), spec.tilt.to_radians().cos());
    let up = [0.0, s, c];
    let z_of = |p: V3| p[1] * s + p[2] * c;
    let bvh = Bvh::new(&outer);
    let comps = components(&cavity);
    let mut tools = vec![cavity.clone()];
    let r = spec.drain / 2.0;
    for comp in &comps {
        let by_z = |a: &&u32, b: &&u32| {
            z_of(cavity.verts[**a as usize]).total_cmp(&z_of(cavity.verts[**b as usize]))
        };
        let (Some(&lo), Some(&hi)) = (comp.iter().min_by(by_z), comp.iter().max_by(by_z)) else {
            continue;
        };
        for (v, sign) in [(lo, -1.0), (hi, 1.0)] {
            let p = cavity.verts[v as usize];
            let d = up.map(|x| x * sign);
            // start a little inside the cavity
            let start = [p[0] - d[0] * 0.3, p[1] - d[1] * 0.3, p[2] - d[2] * 0.3];
            if let Some(len) = bvh.ray(start, d, None, false, 1000.0) {
                tools.push(tube(start, d, &[(0.0, r), (len + 0.6, r)]));
            }
        }
    }
    let drains = tools.len() - 1;

    let tools: Vec<Mesh> = tools.into_iter().map(|t| t.welded(1e-6)).collect();
    let result = Kernel::new()
        .difference(outer.clone(), tools)
        .map_err(|e| e.to_string())?;
    if result.is_empty() {
        return Err("hollowing removed the whole piece".into());
    }
    let removed = outer.volume() - result.volume();
    Ok(Some((
        result,
        HollowReport {
            cavities: comps.len(),
            drains,
            removed,
        },
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cube(s: f64) -> Mesh {
        let v = vec![
            [0., 0., 0.],
            [s, 0., 0.],
            [s, s, 0.],
            [0., s, 0.],
            [0., 0., s],
            [s, 0., s],
            [s, s, s],
            [0., s, s],
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
    fn edt_matches_brute_force() {
        let f = [1e9f32, 1e9, 0.0, 1e9, 1e9, 1e9, 0.0, 1e9];
        let mut d = [0f32; 8];
        let (mut v, mut z) = ([0usize; 8], [0f32; 9]);
        edt_line(&f, &mut d, &mut v, &mut z);
        assert_eq!(d, [4.0, 1.0, 0.0, 1.0, 4.0, 1.0, 0.0, 1.0]);
    }

    #[test]
    fn solid_cube_becomes_a_shell() {
        let m = cube(10.0);
        let spec = HollowSpec {
            wall: 1.0,
            drain: 1.0,
            tilt: 0.0,
        };
        let (h, rep) = hollow(&m, &spec).expect("ok").expect("something to hollow");
        assert_eq!(rep.cavities, 1);
        assert_eq!(rep.drains, 2);
        // cavity is (10 - 2)^3 = 512 of 1000, give or take a voxel of wall
        assert!(
            rep.removed > 380.0 && rep.removed < 600.0,
            "removed {}",
            rep.removed
        );
        assert!(
            h.volume() < 620.0 && h.volume() > 400.0,
            "volume {}",
            h.volume()
        );
    }

    #[test]
    fn thin_piece_is_left_alone() {
        let m = cube(1.5);
        let spec = HollowSpec {
            wall: 1.0,
            drain: 1.0,
            tilt: 0.0,
        };
        assert!(hollow(&m, &spec).unwrap().is_none());
    }

    #[test]
    fn fuse_joins_overlapping_solids() {
        let mut b = cube(4.0);
        for v in &mut b.verts {
            v[0] += 2.0;
        }
        let u = fuse(vec![cube(4.0), b]);
        assert!((u.volume() - 96.0).abs() < 1e-6, "{}", u.volume());
    }
}
