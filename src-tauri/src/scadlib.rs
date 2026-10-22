//! OpenSCAD libraries that ship inside the app, in `src-tauri/scad-lib/`, offered to every
//! model through `use <name.scad>` / `include <name.scad>`. They are served from memory and are
//! never written into a `.fc` file: a project names a library, the app supplies it.
//!
//! Nothing outside that folder is reachable, so projects still can't read the file system.

use include_dir::{Dir, include_dir};
use openrscad_eval::{FileResolver, LoadedFile};

/// The folder `src-tauri/scad-lib/`, compiled into the program.
static BAKED: Dir<'static> = include_dir!("$CARGO_MANIFEST_DIR/scad-lib");

/// Resolves `include`/`use` against the bundled libraries.
pub struct LibResolver;

/// `path` joined onto `dir` with `.` and `..` folded, or `None` if it climbs out of the root.
fn normalize(dir: &str, path: &str) -> Option<String> {
    let mut parts: Vec<&str> = Vec::new();
    let base = if path.starts_with('/') { "" } else { dir };
    for seg in base.split('/').chain(path.split('/')) {
        match seg {
            "" | "." => {}
            ".." => {
                parts.pop()?;
            }
            s => parts.push(s),
        }
    }
    Some(parts.join("/"))
}

/// The library at `rel` (relative to the library root). A debug build reads the folder from disk
/// each time, so edits show up without a rebuild.
fn read(rel: &str) -> Option<String> {
    #[cfg(debug_assertions)]
    {
        let root = std::path::Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/scad-lib"));
        if root.is_dir() {
            return std::fs::read_to_string(root.join(rel)).ok();
        }
    }
    BAKED.get_file(rel)?.contents_utf8().map(str::to_owned)
}

impl FileResolver for LibResolver {
    fn load(&self, path: &str, from_dir: &str) -> Option<LoadedFile> {
        // Relative to the including library first, then from the library root (like OpenSCAD's
        // library path), so `use <nurbs.scad>` works from the model and from inside a library.
        let found = |dir: &str| normalize(dir, path).and_then(|p| read(&p).map(|s| (p, s)));
        let (rel, source) = found(from_dir).or_else(|| found(""))?;
        let dir = rel.rsplit_once('/').map_or("", |(d, _)| d).to_owned();
        Some(LoadedFile {
            key: rel,
            source,
            dir,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_stays_inside_the_root() {
        assert_eq!(normalize(".", "nurbs.scad").as_deref(), Some("nurbs.scad"));
        assert_eq!(normalize("a/b", "../c.scad").as_deref(), Some("a/c.scad"));
        assert_eq!(normalize("a", "/x.scad").as_deref(), Some("x.scad"));
        assert_eq!(normalize(".", "../etc/passwd"), None);
        assert_eq!(normalize("a", "../../x.scad"), None);
    }

    #[test]
    fn every_bundled_file_parses() {
        fn walk(dir: &std::path::Path, bad: &mut Vec<String>) {
            for entry in std::fs::read_dir(dir).unwrap() {
                let path = entry.unwrap().path();
                if path.is_dir() {
                    walk(&path, bad);
                } else if path.extension().is_some_and(|e| e == "scad") {
                    let source = std::fs::read_to_string(&path).unwrap();
                    if let Err(e) = openrscad_syntax::parse(&source) {
                        let (line, _) = crate::render::line_col(&source, e.span.start);
                        bad.push(format!("{}:{line}: {}", path.display(), e.message));
                    }
                }
            }
        }
        let mut bad = Vec::new();
        walk(std::path::Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/scad-lib")), &mut bad);
        assert!(bad.is_empty(), "{bad:#?}");
    }

    #[test]
    fn unknown_files_are_not_found() {
        assert!(LibResolver.load("no-such-lib.scad", ".").is_none());
        assert!(LibResolver.load("../Cargo.toml", ".").is_none());
    }
}
