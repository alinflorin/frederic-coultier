import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { ExportFormat } from "./types";
import { safeName, type WireProject } from "./project";

export const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const PROJECT_FILTER = [{ name: "Frederic Coultier project", extensions: ["fc"] }];

export async function pickProjectToOpen(): Promise<string | null> {
  const p = await open({ multiple: false, directory: false, filters: PROJECT_FILTER });
  return typeof p === "string" ? p : null;
}

export function pickProjectToSave(name: string): Promise<string | null> {
  return save({ defaultPath: `${safeName(name)}.fc`, filters: PROJECT_FILTER });
}

export const openProject = (path: string) => invoke<WireProject>("open_project", { path });

/** Resolves to the path actually written. */
export const saveProject = (path: string, project: WireProject) =>
  invoke<string>("save_project", { path, project });

// --- rendering ---

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  line?: number | null;
  column?: number | null;
}

export interface RenderResult {
  /** Binary STL, or null when the model has no geometry. */
  stl: ArrayBuffer | null;
  echoes: string[];
  diagnostics: Diagnostic[];
  ms: number;
}

export class RenderError extends Error {
  constructor(
    message: string,
    readonly line?: number | null,
    readonly column?: number | null,
  ) {
    super(message);
  }
}

function toRenderError(e: unknown): RenderError {
  if (e && typeof e === "object" && "message" in e) {
    const o = e as { message: unknown; line?: number | null; column?: number | null };
    return new RenderError(String(o.message), o.line, o.column);
  }
  return new RenderError(String(e));
}

/** Reply layout: u32 LE JSON length | JSON | binary STL. */
export async function renderScad(source: string): Promise<RenderResult> {
  let buf: ArrayBuffer;
  try {
    buf = await invoke<ArrayBuffer>("render_scad", { source });
  } catch (e) {
    throw toRenderError(inTauri() ? e : "Rendering needs the desktop app.");
  }
  const jsonLength = new DataView(buf).getUint32(0, true);
  const info = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, jsonLength))) as {
    echoes: string[];
    diagnostics: Diagnostic[];
    ms: number;
    empty: boolean;
  };
  return {
    stl: info.empty ? null : buf.slice(4 + jsonLength),
    echoes: info.echoes,
    diagnostics: info.diagnostics,
    ms: info.ms,
  };
}

// --- export ---

export const EXPORT_FORMATS: { id: ExportFormat; ext: string; label: string }[] = [
  { id: "stl-bin", ext: "stl", label: "STL" },
  { id: "stl-ascii", ext: "stl", label: "STL" },
  { id: "obj", ext: "obj", label: "OBJ" },
  { id: "3mf", ext: "3mf", label: "3MF" },
];

export function pickExportPath(name: string, format: ExportFormat): Promise<string | null> {
  const f = EXPORT_FORMATS.find((x) => x.id === format)!;
  return save({
    defaultPath: `${safeName(name)}.${f.ext}`,
    filters: [{ name: f.label, extensions: [f.ext] }],
  });
}

export const exportModel = (source: string, path: string, format: ExportFormat) =>
  invoke<void>("export_model", { source, path, format });
