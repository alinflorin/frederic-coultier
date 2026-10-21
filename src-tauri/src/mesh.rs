//! An indexed triangle mesh (millimetres, f64) with the measurements and file encodings the app needs,
//! plus the boolean operations used by hollowing and the sprue (the Manifold kernel).

use std::io::Write;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Mesh {
    pub verts: Vec<[f64; 3]>,
    pub tris: Vec<[u32; 3]>,
}

type V3 = [f64; 3];

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

fn norm(a: V3) -> f64 {
    (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]).sqrt()
}

fn normalize(a: V3) -> V3 {
    let n = norm(a);
    if n > 0.0 { [a[0] / n, a[1] / n, a[2] / n] } else { [0.0; 3] }
}

impl Mesh {
    pub fn new() -> Self {
        Mesh::default()
    }

    pub fn is_empty(&self) -> bool {
        self.tris.is_empty()
    }

    fn tri(&self, t: &[u32; 3]) -> [V3; 3] {
        [self.verts[t[0] as usize], self.verts[t[1] as usize], self.verts[t[2] as usize]]
    }

    /// Signed volume (positive when triangles are wound outward / counter-clockwise).
    pub fn signed_volume(&self) -> f64 {
        let mut v = 0.0;
        for t in &self.tris {
            let [a, b, c] = self.tri(t);
            v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0])
                + a[2] * (b[0] * c[1] - b[1] * c[0]);
        }
        v / 6.0
    }

    pub fn volume(&self) -> f64 {
        self.signed_volume().abs()
    }

    pub fn surface_area(&self) -> f64 {
        self.tris
            .iter()
            .map(|t| {
                let [a, b, c] = self.tri(t);
                norm(cross(sub(b, a), sub(c, a))) * 0.5
            })
            .sum()
    }

    /// Axis-aligned bounding box (min, max), or None if there are no vertices.
    pub fn bbox(&self) -> Option<(V3, V3)> {
        let mut it = self.verts.iter();
        let first = *it.next()?;
        let (mut lo, mut hi) = (first, first);
        for v in it {
            for i in 0..3 {
                lo[i] = lo[i].min(v[i]);
                hi[i] = hi[i].max(v[i]);
            }
        }
        Some((lo, hi))
    }

    /// Welds vertices that coincide within `eps` and drops the triangles that collapse. A surface
    /// meshed face by face (a NURBS model) has a separate vertex ring on both sides of every seam;
    /// welded, the shared edges are shared by index, which the checks and the Manifold kernel need.
    pub fn welded(&self, eps: f64) -> Mesh {
        let inv = 1.0 / eps;
        let key = |p: &V3| [(p[0] * inv).round() as i64, (p[1] * inv).round() as i64, (p[2] * inv).round() as i64];
        let mut map: std::collections::HashMap<[i64; 3], u32> = std::collections::HashMap::new();
        let mut verts: Vec<V3> = Vec::with_capacity(self.verts.len());
        let mut remap: Vec<u32> = Vec::with_capacity(self.verts.len());
        for v in &self.verts {
            let id = *map.entry(key(v)).or_insert_with(|| {
                verts.push(*v);
                (verts.len() - 1) as u32
            });
            remap.push(id);
        }
        let tris = self
            .tris
            .iter()
            .map(|t| [remap[t[0] as usize], remap[t[1] as usize], remap[t[2] as usize]])
            .filter(|t| t[0] != t[1] && t[1] != t[2] && t[0] != t[2])
            .collect();
        Mesh { verts, tris }
    }

    /// Reverses the winding if the signed volume is negative.
    pub fn ensure_outward(&mut self) {
        if self.signed_volume() < 0.0 {
            self.flip_winding();
        }
    }

    pub fn flip_winding(&mut self) {
        for t in &mut self.tris {
            t.swap(1, 2);
        }
    }

    /// Reads a binary STL (what Rhino exports), welding the triangle soup into an indexed mesh.
    /// `scale` converts the file's units to millimetres.
    pub fn from_binary_stl(bytes: &[u8], scale: f64, weld: f64) -> Result<Mesh, String> {
        if bytes.len() < 84 {
            return Err("the exported STL is empty".into());
        }
        let n = u32::from_le_bytes([bytes[80], bytes[81], bytes[82], bytes[83]]) as usize;
        if bytes.len() < 84 + n * 50 {
            return Err("the exported STL is cut short (is it an ASCII STL?)".into());
        }
        let f = |at: usize| f64::from(f32::from_le_bytes([bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]])) * scale;
        let mut soup = Mesh { verts: Vec::with_capacity(n * 3), tris: Vec::with_capacity(n) };
        for i in 0..n {
            let o = 84 + i * 50 + 12;
            for k in 0..3 {
                let v = o + k * 12;
                soup.verts.push([f(v), f(v + 4), f(v + 8)]);
            }
            let b = (i * 3) as u32;
            soup.tris.push([b, b + 1, b + 2]);
        }
        Ok(soup.welded(weld))
    }

    pub fn to_binary_stl(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(84 + self.tris.len() * 50);
        out.extend_from_slice(&[0u8; 80]);
        out.extend_from_slice(&(self.tris.len() as u32).to_le_bytes());
        for t in &self.tris {
            let tri = self.tri(t);
            let n = normalize(cross(sub(tri[1], tri[0]), sub(tri[2], tri[0])));
            for comp in n {
                out.extend_from_slice(&(comp as f32).to_le_bytes());
            }
            for v in tri {
                for comp in v {
                    out.extend_from_slice(&(comp as f32).to_le_bytes());
                }
            }
            out.extend_from_slice(&[0u8, 0u8]);
        }
        out
    }

    pub fn to_ascii_stl(&self, name: &str) -> String {
        let mut s = format!("solid {name}\n");
        for t in &self.tris {
            let tri = self.tri(t);
            let n = normalize(cross(sub(tri[1], tri[0]), sub(tri[2], tri[0])));
            s.push_str(&format!("  facet normal {} {} {}\n    outer loop\n", n[0], n[1], n[2]));
            for v in tri {
                s.push_str(&format!("      vertex {} {} {}\n", v[0], v[1], v[2]));
            }
            s.push_str("    endloop\n  endfacet\n");
        }
        s.push_str(&format!("endsolid {name}\n"));
        s
    }

    /// Wavefront OBJ (faces are 1-indexed).
    pub fn to_obj(&self) -> String {
        let mut s = String::new();
        for v in &self.verts {
            s.push_str(&format!("v {} {} {}\n", v[0], v[1], v[2]));
        }
        for t in &self.tris {
            s.push_str(&format!("f {} {} {}\n", t[0] + 1, t[1] + 1, t[2] + 1));
        }
        s
    }

    /// A minimal (core-spec) 3MF package: a ZIP of the model XML and the two OPC parts it needs.
    pub fn to_3mf(&self) -> Vec<u8> {
        const CONTENT_TYPES: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
            <Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">\n \
            <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>\n \
            <Default Extension=\"model\" ContentType=\"application/vnd.ms-package.3dmanufacturing-3dmodel+xml\"/>\n\
            </Types>\n";
        const RELS: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
            <Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\n \
            <Relationship Type=\"http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel\" Target=\"/3D/3dmodel.model\" Id=\"rel0\"/>\n\
            </Relationships>\n";
        let mut model = String::from(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
             <model unit=\"millimeter\" xml:lang=\"en-US\" xmlns=\"http://schemas.microsoft.com/3dmanufacturing/core/2015/02\">\n \
             <resources>\n  <object id=\"1\" type=\"model\">\n   <mesh>\n    <vertices>\n",
        );
        for v in &self.verts {
            model.push_str(&format!("     <vertex x=\"{}\" y=\"{}\" z=\"{}\"/>\n", v[0], v[1], v[2]));
        }
        model.push_str("    </vertices>\n    <triangles>\n");
        for t in &self.tris {
            model.push_str(&format!("     <triangle v1=\"{}\" v2=\"{}\" v3=\"{}\"/>\n", t[0], t[1], t[2]));
        }
        model.push_str("    </triangles>\n   </mesh>\n  </object>\n </resources>\n <build>\n  <item objectid=\"1\"/>\n </build>\n</model>\n");

        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        let opts = zip::write::SimpleFileOptions::default();
        for (name, body) in [
            ("[Content_Types].xml", CONTENT_TYPES.as_bytes()),
            ("_rels/.rels", RELS.as_bytes()),
            ("3D/3dmodel.model", model.as_bytes()),
        ] {
            zip.start_file(name, opts).expect("in-memory zip");
            zip.write_all(body).expect("in-memory zip");
        }
        zip.finish().expect("in-memory zip").into_inner()
    }
}

// ---- Boolean operations (Manifold) ----

fn to_manifold(m: &Mesh) -> Result<manifold_csg::Manifold, String> {
    use manifold_csg::{Manifold, MeshGL64};
    let mut w = m.welded(1e-7);
    w.ensure_outward();
    let props: Vec<f64> = w.verts.iter().flatten().copied().collect();
    let tris: Vec<u64> = w.tris.iter().flatten().map(|&i| u64::from(i)).collect();
    let mesh = MeshGL64::new(&props, 3, &tris).map_err(|e| format!("MeshGL64::new: {e:?}"))?;
    let man = Manifold::from_meshgl64(&mesh).map_err(|e| format!("from_meshgl64: {e:?}"))?;
    man.status().map_err(|e| format!("the mesh is not a closed solid: {e:?}"))?;
    Ok(man)
}

fn from_manifold(man: &manifold_csg::Manifold) -> Mesh {
    let mg = man.to_meshgl64();
    let np = mg.num_prop().max(3);
    let verts = mg.vert_properties().chunks(np).map(|c| [c[0], c[1], c[2]]).collect();
    let tris = mg.tri_verts().chunks(3).map(|c| [c[0] as u32, c[1] as u32, c[2] as u32]).collect();
    Mesh { verts, tris }
}

/// Pairwise (balanced) reduction, which keeps the operands of each boolean about the same size.
fn balanced(mut v: Vec<manifold_csg::Manifold>) -> Option<manifold_csg::Manifold> {
    while v.len() > 1 {
        let mut next = Vec::with_capacity(v.len().div_ceil(2));
        let mut it = v.into_iter();
        while let Some(a) = it.next() {
            next.push(match it.next() {
                Some(b) => &a + &b,
                None => a,
            });
        }
        v = next;
    }
    v.pop()
}

/// The union of the meshes.
pub fn union(parts: &[Mesh]) -> Result<Mesh, String> {
    let mans = parts.iter().filter(|m| !m.is_empty()).map(to_manifold).collect::<Result<Vec<_>, _>>()?;
    Ok(balanced(mans).map(|m| from_manifold(&m)).unwrap_or_default())
}

/// `base` minus all of `tools`.
pub fn difference(base: &Mesh, tools: &[Mesh]) -> Result<Mesh, String> {
    if base.is_empty() {
        return Ok(Mesh::new());
    }
    let base = to_manifold(base)?;
    let tools = tools.iter().filter(|t| !t.is_empty()).map(to_manifold).collect::<Result<Vec<_>, _>>()?;
    let out = match balanced(tools) {
        None => base,
        Some(u) => &base - &u,
    };
    Ok(from_manifold(&out))
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    pub fn cube(at: f64, s: f64) -> Mesh {
        let mut m = Mesh::new();
        for &z in &[0.0, s] {
            for &(x, y) in &[(at, 0.0), (at + s, 0.0), (at + s, s), (at, s)] {
                m.verts.push([x, y, z]);
            }
        }
        m.tris = vec![
            [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
            [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
        ];
        m
    }

    #[test]
    fn measures_a_cube() {
        let m = cube(0.0, 2.0);
        assert!((m.volume() - 8.0).abs() < 1e-9);
        assert!((m.surface_area() - 24.0).abs() < 1e-9);
        assert_eq!(m.bbox(), Some(([0.0; 3], [2.0; 3])));
    }

    #[test]
    fn welding_joins_duplicated_seams() {
        let mut m = cube(0.0, 1.0);
        let n = m.verts.len() as u32;
        m.verts.extend(m.verts.clone());
        for t in &mut m.tris[6..] {
            *t = t.map(|i| i + n);
        }
        assert_eq!(m.welded(1e-6).verts.len(), 8);
    }

    #[test]
    fn inside_out_is_turned_outward() {
        let mut m = cube(0.0, 1.0);
        m.flip_winding();
        assert!(m.signed_volume() < 0.0);
        m.ensure_outward();
        assert!(m.signed_volume() > 0.0);
    }

    #[test]
    fn stl_round_trip() {
        let m = cube(0.0, 2.0);
        let back = Mesh::from_binary_stl(&m.to_binary_stl(), 1.0, 1e-4).unwrap();
        assert_eq!((back.verts.len(), back.tris.len()), (8, 12));
        assert!((back.volume() - 8.0).abs() < 1e-6);
        let inch = Mesh::from_binary_stl(&m.to_binary_stl(), 25.4, 1e-4).unwrap();
        assert!((inch.bbox().unwrap().1[0] - 50.8).abs() < 1e-4);
        assert!(Mesh::from_binary_stl(b"solid", 1.0, 1e-4).is_err());
    }

    #[test]
    fn exports_encode() {
        let m = cube(0.0, 1.0);
        assert_eq!(m.to_binary_stl().len(), 84 + 12 * 50);
        assert!(m.to_ascii_stl("t").starts_with("solid t"));
        assert_eq!(m.to_obj().lines().count(), 8 + 12);
        let z = m.to_3mf();
        assert_eq!(&z[..2], b"PK");
    }

    #[test]
    fn booleans() {
        let (a, b) = (cube(0.0, 2.0), cube(1.0, 2.0));
        let u = union(&[a.clone(), b.clone()]).unwrap();
        // 2x2x2 + 2x2x2 overlapping by 1x2x2
        assert!((u.volume() - 12.0).abs() < 1e-6, "{}", u.volume());
        let d = difference(&a, &[b]).unwrap();
        assert!((d.volume() - 4.0).abs() < 1e-6, "{}", d.volume());
    }
}
