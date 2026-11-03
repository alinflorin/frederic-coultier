//! Mesh files imported into the open project (`import("ring.stl")`).
//!
//! The project does not read the file system: an imported STL is copied into the project, stored
//! in the `.fc` archive under `assets/`, and served to `import()` from memory by name. There is one
//! open project per app, so the store is process-wide; `open_project` replaces its contents and
//! `save_project` writes them out.

use std::collections::BTreeMap;
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex, OnceLock};

use openrscad_geom::Mesh;
use serde::Serialize;

use crate::meshtools::{self, RepairReport};

type Store = BTreeMap<String, Arc<Vec<u8>>>;

fn store() -> &'static Mutex<Store> {
    static S: OnceLock<Mutex<Store>> = OnceLock::new();
    S.get_or_init(Default::default)
}

fn lock() -> std::sync::MutexGuard<'static, Store> {
    store().lock().unwrap_or_else(|p| p.into_inner())
}

/// Replaces everything (a project was opened, or a new one started).
pub fn replace_all(files: impl IntoIterator<Item = (String, Vec<u8>)>) {
    *lock() = files.into_iter().map(|(n, b)| (n, Arc::new(b))).collect();
}

pub fn all() -> BTreeMap<String, Arc<Vec<u8>>> {
    lock().clone()
}

/// The file `name` as `import()` asked for it. Only the last path segment counts, so a model can't
/// name its way out of the store.
pub fn get(name: &str) -> Option<Arc<Vec<u8>>> {
    let base = name.rsplit(['/', '\\']).next()?;
    lock().get(base).cloned()
}

pub fn remove(name: &str) -> bool {
    lock().remove(name).is_some()
}

/// Changes whenever the stored files change, so cached renders of a model that imports them go stale.
pub fn fingerprint() -> u64 {
    let mut h = std::collections::hash_map::DefaultHasher::new();
    for (name, bytes) in lock().iter() {
        name.hash(&mut h);
        bytes.len().hash(&mut h);
        bytes.hash(&mut h);
    }
    h.finish()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetInfo {
    pub name: String,
    pub bytes: usize,
    pub triangles: usize,
    /// Axis-aligned bounds in the file's own units: `[min, max]`.
    pub bounds: Option<[[f64; 3]; 2]>,
    /// Set when the file was open or non-manifold and was repaired on the way in.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repair: Option<RepairReport>,
}

fn info(name: &str, bytes: &[u8]) -> AssetInfo {
    let mesh = Mesh::from_stl(bytes);
    let mut bounds: Option<[[f64; 3]; 2]> = None;
    for &p in &mesh.verts {
        let b = bounds.get_or_insert([p, p]);
        for k in 0..3 {
            b[0][k] = b[0][k].min(p[k]);
            b[1][k] = b[1][k].max(p[k]);
        }
    }
    AssetInfo { name: name.to_owned(), bytes: bytes.len(), triangles: mesh.tris.len(), bounds, repair: None }
}

pub fn list() -> Vec<AssetInfo> {
    lock().iter().map(|(n, b)| info(n, b)).collect()
}

/// A file name usable inside `import("...")` and a zip entry: letters, digits, `.`, `-`, `_`.
fn clean_name(raw: &str) -> String {
    let base = raw.rsplit(['/', '\\']).next().unwrap_or(raw);
    let stem = base.strip_suffix(".stl").or_else(|| base.strip_suffix(".STL")).unwrap_or(base);
    let mut s: String = stem
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    if s.is_empty() {
        s = "mesh".into();
    }
    format!("{s}.stl")
}

/// The bytes with open or non-manifold geometry repaired, plus what was done. The file is kept
/// as it came when it is already clean or when repairing would not leave it better.
fn repaired(bytes: Vec<u8>) -> (Vec<u8>, Option<RepairReport>) {
    let mesh = Mesh::from_stl(&bytes);
    if meshtools::is_clean(&meshtools::analyze(&mesh)) {
        return (bytes, None);
    }
    let (fixed, report) = meshtools::repair(&mesh);
    let defects = |s: &meshtools::MeshStats| s.open_edges + s.non_manifold_edges + s.winding_edges;
    if fixed.tris.is_empty() || defects(&report.after) >= defects(&report.before) {
        return (bytes, None);
    }
    (fixed.to_binary_stl(), Some(report))
}

/// Repairs the stored file `name` in place. Returns None if there is no such file; the report's
/// `after` shows what is left when the damage was more than could be fixed.
pub fn repair(name: &str) -> Option<(AssetInfo, bool)> {
    let bytes = get(name)?;
    let (new, report) = repaired(bytes.to_vec());
    let changed = report.is_some();
    let mut g = lock();
    if changed {
        g.insert(name.to_owned(), Arc::new(new.clone()));
    }
    drop(g);
    Some((AssetInfo { repair: report, ..info(name, &new) }, changed))
}

/// Adds an STL (binary or ASCII) under a name derived from `file_name`, never replacing another
/// file: a clash gets `-2`, `-3`, ... Rejects files with no triangles.
pub fn add_stl(file_name: &str, bytes: Vec<u8>) -> Result<AssetInfo, String> {
    let mut probe = info("", &bytes);
    if probe.triangles == 0 {
        return Err("this file has no triangles; only STL (binary or ASCII) can be imported".into());
    }
    let (bytes, report) = repaired(bytes);
    if report.is_some() {
        probe = AssetInfo { repair: report, ..info("", &bytes) };
    }
    let wanted = clean_name(file_name);
    let mut g = lock();
    let mut name = wanted.clone();
    let stem = wanted.trim_end_matches(".stl").to_owned();
    let mut n = 2;
    while g.contains_key(&name) {
        name = format!("{stem}-{n}.stl");
        n += 1;
    }
    g.insert(name.clone(), Arc::new(bytes));
    drop(g);
    Ok(AssetInfo { name, ..probe })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The store is process-wide, so tests that use it take turns.
    static TURN: Mutex<()> = Mutex::new(());

    fn tetra() -> Vec<u8> {
        let tris = [
            [[0., 0., 0.], [10., 0., 0.], [0., 10., 0.]],
            [[0., 0., 0.], [0., 0., 10.], [10., 0., 0.]],
            [[0., 0., 0.], [0., 10., 0.], [0., 0., 10.]],
            [[10., 0., 0.], [0., 0., 10.], [0., 10., 0.]],
        ];
        let mut out = vec![0u8; 80];
        out.extend((tris.len() as u32).to_le_bytes());
        for t in tris {
            out.extend([0u8; 12]);
            for v in t {
                for c in v {
                    out.extend((c as f32).to_le_bytes());
                }
            }
            out.extend([0u8; 2]);
        }
        out
    }

    #[test]
    fn names_are_cleaned_and_unique() {
        assert_eq!(clean_name("/a/b/My Ring (v2).STL"), "My_Ring__v2_.stl");
        assert_eq!(clean_name(""), "mesh.stl");
    }

    #[test]
    fn import_renders_and_can_be_cut() {
        let _turn = TURN.lock().unwrap_or_else(|p| p.into_inner());
        replace_all([]);
        let a = add_stl("part.stl", tetra()).unwrap();
        let b = add_stl("part.stl", tetra()).unwrap();
        assert_eq!(a.name, "part.stl");
        assert_eq!(b.name, "part-2.stl");
        assert_eq!(a.triangles, 4);
        assert_eq!(a.bounds.unwrap()[1], [10.0, 10.0, 10.0]);
        assert!(get("../../part.stl").is_some());
        assert!(add_stl("bad.stl", vec![1, 2, 3]).is_err());

        let whole = crate::render::render_plain("import(\"part.stl\");".into()).unwrap();
        let cut = crate::render::render_plain(
            "difference(){ import(\"part.stl\"); translate([-1,-1,5]) cube(20); }".into(),
        )
        .unwrap();
        assert!(whole.mesh.tris.len() > 0);
        assert!(cut.mesh.tris.len() > 0);
        assert_ne!(whole.mesh.tris.len(), cut.mesh.tris.len());
        replace_all([]);
    }

    /// The shape of source the Import dialog writes (see `src/importScad.ts`): variables, then a
    /// `difference()` with half-space and box cutters.
    #[test]
    fn dialog_style_cuts_remove_the_right_sections() {
        let _turn = TURN.lock().unwrap_or_else(|p| p.into_inner());
        replace_all([]);
        add_stl("part.stl", tetra()).unwrap();
        let zmax = |src: &str| {
            let m = crate::render::render_plain(src.into()).unwrap().mesh;
            m.verts.iter().map(|v| v[2]).fold(f64::MIN, f64::max)
        };
        let xmin = |src: &str| {
            let m = crate::render::render_plain(src.into()).unwrap().mesh;
            m.verts.iter().map(|v| v[0]).fold(f64::MAX, f64::min)
        };
        let above = "part_cut1_z = 5; // [-1:0.1:11]\n\
            difference() {\n  import(\"part.stl\");\n  translate([-110, -110, part_cut1_z]) cube([110 * 2, 110 * 2, 110]);\n}\n";
        assert!((zmax(above) - 5.0).abs() < 1e-6, "{}", zmax(above));
        let below = "part_cut2_x = 2; // [-1:0.1:11]\n\
            difference() {\n  import(\"part.stl\");\n  translate([part_cut2_x - 110, -110, -110]) cube([110, 110 * 2, 110 * 2]);\n}\n";
        assert!((xmin(below) - 2.0).abs() < 1e-6, "{}", xmin(below));
        replace_all([]);
    }
}
