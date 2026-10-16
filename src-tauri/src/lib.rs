mod agent;
mod bvh;
mod checks;
mod hollow;
mod meshtools;
mod project;
mod render;
mod supports;

use std::path::PathBuf;

use serde::Serialize;
use tauri::State;
use tauri::ipc::Response;

use meshtools::{Finding, MeshStats, SimplifyReport, SimplifySpec, SprueSpec};
use project::Project;
use render::{RenderCache, RenderFailure};
use supports::{AutoParams, AutoResult, PrintParams, Support, TiltRow};

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
async fn render_scad(
    source: String,
    cache: State<'_, RenderCache>,
) -> Result<Response, RenderFailure> {
    let cache = cache.inner().clone();
    let rendered =
        tauri::async_runtime::spawn_blocking(move || render::render_on_big_stack(source, &cache))
            .await
            .map_err(|e| RenderFailure {
                message: e.to_string(),
                line: None,
                column: None,
            })??;

    let empty = rendered.mesh.is_empty();
    let info = serde_json::to_vec(&RenderInfo {
        echoes: rendered.echoes,
        diagnostics: rendered.diagnostics,
        ms: rendered.ms,
        empty,
    })
    .map_err(|e| RenderFailure {
        message: e.to_string(),
        line: None,
        column: None,
    })?;

    let stl = if empty {
        Vec::new()
    } else {
        rendered.mesh.to_binary_stl()
    };
    let mut out = Vec::with_capacity(4 + info.len() + stl.len());
    out.extend_from_slice(&(info.len() as u32).to_le_bytes());
    out.extend_from_slice(&info);
    out.extend_from_slice(&stl);
    Ok(Response::new(out))
}

/// Supports to bake into an export, in the model's coordinates.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrintSpec {
    params: PrintParams,
    supports: Vec<Support>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MeshReport {
    stats: MeshStats,
    findings: Vec<Finding>,
    simplify: Option<SimplifyReport>,
}

/// Measurements, print checks and (optionally) a dry run of the simplification.
#[tauri::command]
async fn mesh_report(
    source: String,
    simplify: Option<SimplifySpec>,
    checks: Option<checks::CheckOptions>,
    cache: State<'_, RenderCache>,
) -> Result<MeshReport, String> {
    let cache = cache.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mesh = render::mesh_for(&source, &cache).map_err(failure_text)?;
        let stats = meshtools::analyze(&mesh);
        let mut findings = meshtools::validate(&stats);
        let watertight = stats.triangles > 0
            && stats.open_edges + stats.non_manifold_edges + stats.winding_edges == 0;
        if let Some(o) = checks.filter(|_| watertight) {
            findings.extend(checks::deep_checks(&mesh, &o));
        } else if checks.is_some() && stats.triangles > 0 {
            findings.push(Finding {
                level: "info",
                code: "deepSkipped",
                detail: String::new(),
                at: Vec::new(),
            });
        }
        let simplify = if mesh.is_empty() {
            None
        } else {
            simplify.map(|s| meshtools::simplify(&mesh, &s).1)
        };
        Ok(MeshReport {
            stats,
            findings,
            simplify,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

fn failure_text(e: RenderFailure) -> String {
    e.message
}

/// Ranks print orientations (tilt about X), best first.
#[tauri::command]
async fn suggest_tilt(
    source: String,
    min: f64,
    max: f64,
    step: f64,
    angle: f64,
    lift: f64,
    cache: State<'_, RenderCache>,
) -> Result<Vec<TiltRow>, String> {
    let cache = cache.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mesh = render::mesh_for(&source, &cache).map_err(failure_text)?;
        if mesh.is_empty() {
            return Err("The model is empty.".to_string());
        }
        Ok(supports::rank_tilts(
            &mesh,
            min,
            max,
            step.max(1.0),
            angle,
            lift,
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// (Re)generates the automatic supports; `manual` ones are kept.
#[tauri::command]
async fn auto_supports(
    source: String,
    print: PrintParams,
    auto: AutoParams,
    manual: Vec<Support>,
    next_id: u32,
    cache: State<'_, RenderCache>,
) -> Result<AutoResult, String> {
    let cache = cache.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mesh = render::mesh_for(&source, &cache).map_err(failure_text)?;
        supports::auto_supports(&mesh, &print, &auto, &manual, next_id)
            .ok_or_else(|| "The model is empty.".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// The piece as it will be printed. Reply: `u32 LE JSON length | JSON {size, fits, modelLen} |
/// binary STL of the tilted model | binary STL of the supports and raft | binary STL of the sprue`.
#[tauri::command]
async fn print_layout(
    source: String,
    print: PrintParams,
    supports: Vec<Support>,
    sprue: Option<SprueSpec>,
    cache: State<'_, RenderCache>,
) -> Result<Response, String> {
    let cache = cache.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut mesh = render::mesh_for(&source, &cache).map_err(failure_text)?;
        // show the casting sprue too: stub added as a separate shell, enough for a preview
        let planned = sprue.and_then(|s| meshtools::plan_sprue_at(&mesh, &s));
        let sprue_at = planned.as_ref().map(|p| p.2);
        let stub = planned.map(|(m, _, _)| m);
        let (zoff, frame) = supports::frame(&mesh, &print).ok_or("The model is empty.")?;
        let model = supports::tilted_model(&mesh, &print, zoff).to_binary_stl();
        let sprue_stl = stub
            .map(|m| supports::tilted_model(&m, &print, zoff).to_binary_stl())
            .unwrap_or_default();
        let sup = if supports.is_empty() { Vec::new() } else { supports::support_mesh(&supports, &print, zoff).to_binary_stl() };
        let info = serde_json::to_vec(&serde_json::json!({
            "size": frame.size, "fits": frame.fits, "modelLen": model.len(), "supportsLen": sup.len(), "zoff": zoff, "sprueAt": sprue_at,
        }))
        .map_err(|e| e.to_string())?;
        let mut out = Vec::with_capacity(4 + info.len() + model.len() + sup.len() + sprue_stl.len());
        out.extend_from_slice(&(info.len() as u32).to_le_bytes());
        out.extend_from_slice(&info);
        out.extend_from_slice(&model);
        out.extend_from_slice(&sup);
        out.extend_from_slice(&sprue_stl);
        Ok(Response::new(out))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Exports the model to `path` in `format`: stl-bin, stl-ascii, obj or 3mf.
/// With `print`, the piece is tilted and the supports and raft are baked in.
#[tauri::command]
async fn export_model(
    source: String,
    path: PathBuf,
    format: String,
    print: Option<PrintSpec>,
    simplify: Option<SimplifySpec>,
    sprue: Option<SprueSpec>,
    hollow: Option<hollow::HollowSpec>,
    cache: State<'_, RenderCache>,
) -> Result<(), String> {
    let cache = cache.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut mesh = render::mesh_for(&source, &cache).map_err(|e| e.message)?;
        if mesh.is_empty() {
            return Err("There is nothing to export: the model is empty.".to_string());
        }
        // order: hollow, sprue, simplify, then tilt + supports
        let solid = mesh.clone();
        if let Some(spec) = hollow {
            if let Some((h, _)) = hollow::hollow(&mesh, &spec)? {
                mesh = std::sync::Arc::new(h);
            }
        }
        if let Some(spec) = sprue {
            // placed on the solid piece, where the metal is thickest
            let (stub, _) = meshtools::plan_sprue(&solid, &spec)
                .ok_or("No free spot for a sprue on this piece.")?;
            mesh = std::sync::Arc::new(hollow::fuse(vec![(*mesh).clone(), stub]));
        }
        if let Some(spec) = simplify {
            mesh = std::sync::Arc::new(meshtools::simplify(&mesh, &spec).0);
        }
        if let Some(spec) = print.filter(|s| !s.supports.is_empty()) {
            let baked =
                supports::bake(&mesh, &spec.supports, &spec.params).ok_or("The model is empty.")?;
            mesh = std::sync::Arc::new(baked);
        }
        let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("model");
        let bytes = render::encode(&format, &mesh, name)
            .ok_or_else(|| format!("unknown export format {format}"))?;
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
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(RenderCache::default())
        .setup(|app| {
            agent::start(app.handle());
            agent::chat::manage(app.handle());
            Ok(())
        });

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .invoke_handler(tauri::generate_handler![
            agent::bridge::agent_reply,
            agent::mcp_status,
            agent::mcp_configure,
            agent::connect::mcp_agents,
            agent::kb_search,
            agent::kb_read,
            agent::chat::chat_engines,
            agent::chat::chat_send,
            agent::chat::chat_cancel,
            agent::chat::chat_load,
            agent::chat::chat_save,
            agent::connect::mcp_connect,
            open_project,
            save_project,
            render_scad,
            export_model,
            suggest_tilt,
            auto_supports,
            print_layout,
            mesh_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
