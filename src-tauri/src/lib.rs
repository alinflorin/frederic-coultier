mod project;
mod render;

use std::path::PathBuf;

use serde::Serialize;
use tauri::ipc::Response;
use tauri::State;

use project::Project;
use render::{RenderCache, RenderFailure};

#[tauri::command]
fn open_project(path: PathBuf) -> Result<Project, String> {
    project::read_project(&path).map_err(|e| e.to_string())
}

/// Saves and returns the path actually written (a `.fc` extension is added if missing).
#[tauri::command]
fn save_project(path: PathBuf, project: Project) -> Result<String, String> {
    project::write_project(&path, &project)
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RenderInfo {
    echoes: Vec<String>,
    diagnostics: Vec<render::Diagnostic>,
    ms: u64,
    empty: bool,
}

/// Renders OpenSCAD source. The reply is binary, to avoid pushing megabytes of
/// mesh through JSON: `u32 LE JSON length | RenderInfo JSON | binary STL`.
#[tauri::command]
async fn render_scad(source: String, cache: State<'_, RenderCache>) -> Result<Response, RenderFailure> {
    let cache = cache.inner().clone();
    let rendered = tauri::async_runtime::spawn_blocking(move || render::render_on_big_stack(source, &cache))
        .await
        .map_err(|e| RenderFailure { message: e.to_string(), line: None, column: None })??;

    let empty = rendered.mesh.is_empty();
    let info = serde_json::to_vec(&RenderInfo {
        echoes: rendered.echoes,
        diagnostics: rendered.diagnostics,
        ms: rendered.ms,
        empty,
    })
    .map_err(|e| RenderFailure { message: e.to_string(), line: None, column: None })?;

    let stl = if empty { Vec::new() } else { rendered.mesh.to_binary_stl() };
    let mut out = Vec::with_capacity(4 + info.len() + stl.len());
    out.extend_from_slice(&(info.len() as u32).to_le_bytes());
    out.extend_from_slice(&info);
    out.extend_from_slice(&stl);
    Ok(Response::new(out))
}

/// Exports the model to `path` in `format`: stl-bin, stl-ascii, obj or 3mf.
#[tauri::command]
async fn export_model(
    source: String,
    path: PathBuf,
    format: String,
    cache: State<'_, RenderCache>,
) -> Result<(), String> {
    let cache = cache.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mesh = render::mesh_for(&source, &cache).map_err(|e| e.message)?;
        if mesh.is_empty() {
            return Err("There is nothing to export: the model is empty.".to_string());
        }
        let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("model");
        let bytes = render::encode(&format, &mesh, name).ok_or_else(|| format!("unknown export format {format}"))?;
        std::fs::write(&path, bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(RenderCache::default());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .invoke_handler(tauri::generate_handler![open_project, save_project, render_scad, export_model])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
