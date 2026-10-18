//! The `.fc` project container.
//!
//! A `.fc` file is a zip archive holding everything a project needs:
//!
//! | entry           | content                                              |
//! |-----------------|------------------------------------------------------|
//! | `manifest.json` | `{ format, version, app }`, checked on open          |
//! | `model.scad`    | the OpenSCAD source                                  |
//! | `settings.json` | project settings (material, render, printing, ...)   |
//! | `chat.json`     | the design conversation                              |
//! | `supports.json` | print supports                                       |
//! | `history.json`  | version history: snapshots of source, settings, supports |
//!
//! `settings`, `chat`, `supports` and `history` are opaque JSON here: the frontend owns
//! their schema and fills in defaults for anything missing, so older files
//! keep opening as the schema grows.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

pub const FORMAT: &str = "frederic-coultier-project";
pub const VERSION: u32 = 1;
const EXTENSION: &str = "fc";
/// Upper bound for a single entry, so a hostile file can't exhaust memory.
const MAX_ENTRY_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum ProjectError {
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("not a valid project file: {0}")]
    Archive(#[from] zip::result::ZipError),
    #[error("not a valid project file: {0}")]
    Json(#[from] serde_json::Error),
    #[error("this is not a Frederic Coultier project")]
    WrongFormat,
    #[error(
        "this project was made with a newer version of the app (file version {0}, supported {VERSION})"
    )]
    TooNew(u32),
    #[error("project file is missing {0}")]
    Missing(&'static str),
    #[error("project entry {0} is too large")]
    TooLarge(&'static str),
}

#[derive(Serialize, Deserialize)]
struct Manifest {
    format: String,
    version: u32,
    app: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Project {
    pub source: String,
    pub settings: Value,
    pub chat: Value,
    pub supports: Value,
    #[serde(default)]
    pub history: Value,
}

fn read_entry<R: Read + std::io::Seek>(
    zip: &mut ZipArchive<R>,
    name: &'static str,
) -> Result<Option<Vec<u8>>, ProjectError> {
    let entry = match zip.by_name(name) {
        Ok(e) => e,
        Err(zip::result::ZipError::FileNotFound) => return Ok(None),
        Err(e) => return Err(e.into()),
    };
    let mut buf = Vec::new();
    entry.take(MAX_ENTRY_BYTES + 1).read_to_end(&mut buf)?;
    if buf.len() as u64 > MAX_ENTRY_BYTES {
        return Err(ProjectError::TooLarge(name));
    }
    Ok(Some(buf))
}

fn read_json<R: Read + std::io::Seek>(
    zip: &mut ZipArchive<R>,
    name: &'static str,
    default: Value,
) -> Result<Value, ProjectError> {
    match read_entry(zip, name)? {
        Some(bytes) => Ok(serde_json::from_slice(&bytes)?),
        None => Ok(default),
    }
}

pub fn read_project(path: &Path) -> Result<Project, ProjectError> {
    let mut zip = ZipArchive::new(File::open(path)?)?;

    let manifest: Manifest = serde_json::from_slice(
        &read_entry(&mut zip, "manifest.json")?.ok_or(ProjectError::WrongFormat)?,
    )
    .map_err(|_| ProjectError::WrongFormat)?;
    if manifest.format != FORMAT {
        return Err(ProjectError::WrongFormat);
    }
    if manifest.version > VERSION {
        return Err(ProjectError::TooNew(manifest.version));
    }

    let source = read_entry(&mut zip, "model.scad")?.ok_or(ProjectError::Missing("model.scad"))?;
    Ok(Project {
        source: String::from_utf8_lossy(&source).into_owned(),
        settings: read_json(&mut zip, "settings.json", json!({}))?,
        chat: read_json(&mut zip, "chat.json", json!([]))?,
        supports: read_json(&mut zip, "supports.json", json!({}))?,
        history: read_json(&mut zip, "history.json", json!([]))?,
    })
}

/// Writes the project atomically (temp file + rename) so a crash or full disk
/// can't destroy an existing file. Returns the path actually written, which
/// gets a `.fc` extension if the caller left it off.
pub fn write_project(path: &Path, project: &Project) -> Result<PathBuf, ProjectError> {
    let mut target = path.to_path_buf();
    if target.extension().and_then(|e| e.to_str()) != Some(EXTENSION) {
        let mut name = target.file_name().unwrap_or_default().to_os_string();
        name.push(".");
        name.push(EXTENSION);
        target.set_file_name(name);
    }

    let mut tmp_name = target.file_name().unwrap_or_default().to_os_string();
    tmp_name.push(".tmp");
    let tmp = target.with_file_name(tmp_name);

    let result = (|| -> Result<(), ProjectError> {
        let mut zip = ZipWriter::new(File::create(&tmp)?);
        let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        let manifest = Manifest {
            format: FORMAT.into(),
            version: VERSION,
            app: env!("CARGO_PKG_VERSION").into(),
        };
        let entries: [(&str, Vec<u8>); 6] = [
            ("manifest.json", serde_json::to_vec_pretty(&manifest)?),
            ("model.scad", project.source.clone().into_bytes()),
            (
                "settings.json",
                serde_json::to_vec_pretty(&project.settings)?,
            ),
            ("chat.json", serde_json::to_vec_pretty(&project.chat)?),
            (
                "supports.json",
                serde_json::to_vec_pretty(&project.supports)?,
            ),
            ("history.json", serde_json::to_vec(&project.history)?),
        ];
        for (name, bytes) in entries {
            zip.start_file(name, opts)?;
            zip.write_all(&bytes)?;
        }
        zip.finish()?.sync_all()?;
        fs::rename(&tmp, &target)?;
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result.map(|()| target)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Project {
        Project {
            source: "cube(1);\n// ünïcode ✓\n".into(),
            settings: json!({ "general": { "name": "Ring" } }),
            chat: json!([{ "id": "1", "role": "user", "text": "hi" }]),
            supports: json!({ "auto": 3 }),
            history: json!([{ "id": "s1", "label": "first" }]),
        }
    }

    #[test]
    fn round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let written = write_project(&dir.path().join("ring"), &sample()).unwrap();
        assert_eq!(written.file_name().unwrap(), "ring.fc");
        assert_eq!(read_project(&written).unwrap(), sample());
        assert!(!dir.path().join("ring.fc.tmp").exists());
    }

    #[test]
    fn overwrite_keeps_file_valid() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.fc");
        write_project(&path, &sample()).unwrap();
        let mut p = sample();
        p.source = "sphere(2);".into();
        write_project(&path, &p).unwrap();
        assert_eq!(read_project(&path).unwrap().source, "sphere(2);");
    }

    #[test]
    fn rejects_foreign_zip_and_garbage() {
        let dir = tempfile::tempdir().unwrap();
        let junk = dir.path().join("junk.fc");
        fs::write(&junk, b"definitely not a zip").unwrap();
        assert!(read_project(&junk).is_err());

        let other = dir.path().join("other.fc");
        let mut zip = ZipWriter::new(File::create(&other).unwrap());
        zip.start_file("hello.txt", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"hi").unwrap();
        zip.finish().unwrap();
        assert!(matches!(
            read_project(&other),
            Err(ProjectError::WrongFormat)
        ));
    }

    #[test]
    fn rejects_newer_version() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("new.fc");
        let mut zip = ZipWriter::new(File::create(&path).unwrap());
        zip.start_file("manifest.json", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(br#"{"format":"frederic-coultier-project","version":99,"app":"9.0.0"}"#)
            .unwrap();
        zip.finish().unwrap();
        assert!(matches!(read_project(&path), Err(ProjectError::TooNew(99))));
    }

    #[test]
    fn missing_optional_entries_get_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("min.fc");
        let mut zip = ZipWriter::new(File::create(&path).unwrap());
        let o = SimpleFileOptions::default();
        zip.start_file("manifest.json", o).unwrap();
        zip.write_all(br#"{"format":"frederic-coultier-project","version":1,"app":"0"}"#)
            .unwrap();
        zip.start_file("model.scad", o).unwrap();
        zip.write_all(b"cube(1);").unwrap();
        zip.finish().unwrap();
        let p = read_project(&path).unwrap();
        assert_eq!(p.source, "cube(1);");
        assert_eq!(p.chat, json!([]));
        assert_eq!(p.settings, json!({}));
        assert_eq!(p.history, json!([]));
    }
}
