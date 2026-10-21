//! Preview mesh with everything the viewer needs already computed (smooth or flat normals, feature
//! edges, volume), so the UI thread only wraps the buffers.
//!
//! Layout, all little-endian and 4-byte aligned:
//! `u32 vertices | u32 triangles | u32 indexed (0 or 1) | u32 edge vertices | f32 volume |`
//! `f32 xyz positions | f32 xyz normals | u32 abc indices (only when indexed) | f32 xyz edge segments`.

use crate::mesh::Mesh;

/// Size of the fixed header; a payload no longer than this holds no geometry.
pub const HEADER: usize = 20;

pub enum Shading {
    /// Smooth normals across edges flatter than `crease` (radians), indexed, with feature edges
    /// sharper than `edge_angle` (radians) as line segments. Same result as three.js'
    /// `toCreasedNormals` + `EdgesGeometry`.
    Creased { crease: f64, edge_angle: f64 },
    /// One normal per face, unindexed, no edges.
    Flat,
}

type V3 = [f64; 3];

fn sub(a: V3, b: V3) -> V3 {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn cross(a: V3, b: V3) -> V3 {
    [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
fn dot(a: V3, b: V3) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
fn unit(a: V3) -> V3 {
    let l = dot(a, a).sqrt();
    if l > 0.0 { [a[0] / l, a[1] / l, a[2] / l] } else { [0.0; 3] }
}

/// Volume from signed tetrahedra; assumes a closed mesh.
fn volume(mesh: &Mesh) -> f64 {
    let mut v = 0.0;
    for t in &mesh.tris {
        let (a, b, c) = (mesh.verts[t[0] as usize], mesh.verts[t[1] as usize], mesh.verts[t[2] as usize]);
        v += dot(a, cross(b, c)) / 6.0;
    }
    v.abs()
}

fn push_f32(out: &mut Vec<u8>, v: [f64; 3]) {
    for c in v {
        out.extend_from_slice(&(c as f32).to_le_bytes());
    }
}

fn push_u32(out: &mut Vec<u8>, v: u32) {
    out.extend_from_slice(&v.to_le_bytes());
}

pub fn encode(mesh: &Mesh, shading: &Shading) -> Vec<u8> {
    if mesh.tris.is_empty() {
        return Vec::new();
    }
    let face_n: Vec<V3> = mesh
        .tris
        .iter()
        .map(|t| {
            let (a, b, c) = (mesh.verts[t[0] as usize], mesh.verts[t[1] as usize], mesh.verts[t[2] as usize]);
            cross(sub(b, a), sub(c, a)) // length is twice the area
        })
        .collect();
    let vol = volume(mesh);

    match shading {
        Shading::Flat => {
            let nt = mesh.tris.len();
            let mut out = Vec::with_capacity(HEADER + nt * 72);
            for v in [nt as u32 * 3, nt as u32, 0, 0] {
                push_u32(&mut out, v);
            }
            out.extend_from_slice(&(vol as f32).to_le_bytes());
            for t in &mesh.tris {
                for &i in t {
                    push_f32(&mut out, mesh.verts[i as usize]);
                }
            }
            for n in &face_n {
                let n = unit(*n);
                for _ in 0..3 {
                    push_f32(&mut out, n);
                }
            }
            out
        }
        Shading::Creased { crease, edge_angle } => {
            let (verts, normals, indices) = creased(mesh, &face_n, crease.cos());
            let edges = feature_edges(mesh, &face_n, edge_angle.cos());
            let mut out = Vec::with_capacity(HEADER + verts.len() * 24 + indices.len() * 4 + edges.len() * 12);
            for v in [verts.len() as u32, mesh.tris.len() as u32, 1, edges.len() as u32] {
                push_u32(&mut out, v);
            }
            out.extend_from_slice(&(vol as f32).to_le_bytes());
            for v in &verts {
                push_f32(&mut out, *v);
            }
            for n in &normals {
                push_f32(&mut out, *n);
            }
            for i in &indices {
                push_u32(&mut out, *i);
            }
            for e in &edges {
                push_f32(&mut out, *e);
            }
            out
        }
    }
}

/// Splits vertices where the surrounding faces disagree by more than the crease angle, and averages
/// (area-weighted) the normals of the faces that agree. Corners of one vertex whose normals come
/// out the same share an output vertex.
fn creased(mesh: &Mesh, face_n: &[V3], cos: f64) -> (Vec<V3>, Vec<V3>, Vec<u32>) {
    let nv = mesh.verts.len();
    // faces around each vertex, as a flat list with offsets
    let mut start = vec![0u32; nv + 1];
    for t in &mesh.tris {
        for &i in t {
            start[i as usize + 1] += 1;
        }
    }
    for i in 0..nv {
        start[i + 1] += start[i];
    }
    let mut fill = start.clone();
    let mut around = vec![0u32; mesh.tris.len() * 3];
    for (f, t) in mesh.tris.iter().enumerate() {
        for &i in t {
            around[fill[i as usize] as usize] = f as u32;
            fill[i as usize] += 1;
        }
    }
    let unit_n: Vec<V3> = face_n.iter().map(|n| unit(*n)).collect();

    let mut verts: Vec<V3> = Vec::with_capacity(nv);
    let mut normals: Vec<V3> = Vec::with_capacity(nv);
    let mut indices = vec![0u32; mesh.tris.len() * 3];
    let mut made: Vec<u32> = Vec::new(); // output vertices of the current input vertex
    for v in 0..nv {
        made.clear();
        let faces = &around[start[v] as usize..start[v + 1] as usize];
        for &f in faces {
            let un = unit_n[f as usize];
            let mut sum = [0.0; 3];
            for &g in faces {
                if dot(un, unit_n[g as usize]) >= cos - 1e-12 {
                    let n = face_n[g as usize];
                    sum = [sum[0] + n[0], sum[1] + n[1], sum[2] + n[2]];
                }
            }
            let n = unit(sum);
            let out = match made.iter().find(|&&o| dot(normals[o as usize], n) > 0.9999) {
                Some(&o) => o,
                None => {
                    verts.push(mesh.verts[v]);
                    normals.push(n);
                    made.push(verts.len() as u32 - 1);
                    verts.len() as u32 - 1
                }
            };
            let t = &mesh.tris[f as usize];
            let corner = t.iter().position(|&i| i as usize == v).unwrap_or(0);
            indices[f as usize * 3 + corner] = out;
        }
    }
    (verts, normals, indices)
}

/// Segments (as vertex pairs) of edges that bound one face or join two faces meeting at more
/// than the threshold angle.
fn feature_edges(mesh: &Mesh, face_n: &[V3], cos: f64) -> Vec<V3> {
    let mut half: Vec<(u64, u32)> = Vec::with_capacity(mesh.tris.len() * 3);
    for (f, t) in mesh.tris.iter().enumerate() {
        for k in 0..3 {
            let (a, b) = (t[k], t[(k + 1) % 3]);
            let (lo, hi) = if a < b { (a, b) } else { (b, a) };
            half.push((((lo as u64) << 32) | hi as u64, f as u32));
        }
    }
    half.sort_unstable();
    let mut out = Vec::new();
    let mut i = 0;
    while i < half.len() {
        let mut j = i + 1;
        while j < half.len() && half[j].0 == half[i].0 {
            j += 1;
        }
        let sharp = j - i == 1 || {
            let (a, b) = (unit(face_n[half[i].1 as usize]), unit(face_n[half[i + 1].1 as usize]));
            dot(a, b) <= cos
        };
        if sharp {
            let key = half[i].0;
            out.push(mesh.verts[(key >> 32) as usize]);
            out.push(mesh.verts[(key & 0xffff_ffff) as usize]);
        }
        i = j;
    }
    out
}
