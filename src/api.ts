import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { ExportFormat, FcProject, Support } from "./types";
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

export interface SprueOpts {
  diameter: number;
  length: number;
  at?: [number, number, number] | null;
}

export interface ExportOptions {
  print?: PrintSpec;
  simplify?: { keepPercent: number; maxVolumeChange: number };
  sprue?: SprueOpts;
  hollow?: { wall: number; drain: number; tilt: number };
}

export const exportModel = (source: string, path: string, format: ExportFormat, o: ExportOptions = {}) =>
  invoke<void>("export_model", {
    source,
    path,
    format,
    print: o.print ?? null,
    simplify: o.simplify ?? null,
    sprue: o.sprue ?? null,
    hollow: o.hollow ?? null,
  });

// --- analysis ---

export interface MeshStats {
  triangles: number;
  vertices: number;
  volume: number;
  area: number;
  size: [number, number, number];
  shells: number;
  openEdges: number;
  nonManifoldEdges: number;
  windingEdges: number;
  degenerate: number;
}

export interface Finding {
  level: "pass" | "warn" | "fail" | "info";
  code: string;
  detail: string;
  /** Where the problem is, in model coordinates. */
  at?: [number, number, number][];
}

export interface SimplifyReport {
  before: number;
  after: number;
  accepted: boolean;
  reason: string | null;
  volumeChange: number;
}

export interface MeshReport {
  stats: MeshStats;
  findings: Finding[];
  simplify: SimplifyReport | null;
}

export const meshReport = (
  source: string,
  simplify?: { keepPercent: number; maxVolumeChange: number },
  checks?: { minWall: number; minGap: number },
) => invoke<MeshReport>("mesh_report", { source, simplify: simplify ?? null, checks: checks ?? null });

// --- supports ---

type SupportSettings = FcProject["settings"]["printing"]["supports"];

export interface PrintParams {
  tilt: number;
  lift: number;
  tip: number;
  base: number;
  raft: number;
  raftRadius: number;
}

export interface PrintSpec {
  params: PrintParams;
  supports: Support[];
}

export function printParams(tilt: number, s: SupportSettings): PrintParams {
  return { tilt, lift: s.lift, tip: s.tipRadius, base: s.baseRadius, raft: s.raftThickness, raftRadius: s.raftRadius };
}

export interface TiltRow {
  tilt: number;
  overhang: number;
  flat: number;
  size: [number, number, number];
  fits: boolean;
}

export const suggestTilt = (source: string, angle: number, lift: number) =>
  invoke<TiltRow[]>("suggest_tilt", { source, min: 0, max: 60, step: 5, angle, lift });

export interface AutoResult {
  supports: Support[];
  nextId: number;
  stats: { overhangFaces: number; samples: number; added: number; kept: number; blocked: number };
}

export const autoSupports = (
  source: string,
  print: PrintParams,
  s: SupportSettings,
  manual: Support[],
  nextId: number,
) =>
  invoke<AutoResult>("auto_supports", {
    source,
    print,
    auto: { angle: s.overhangAngle, spacing: s.spacing, step: 1, bias: 3 },
    manual,
    nextId,
  });

export interface PrintLayout {
  model: ArrayBuffer;
  /** Supports and raft, null when there are none. */
  supports: ArrayBuffer | null;
  /** The casting sprue, null when off or no spot was found. */
  sprue: ArrayBuffer | null;
  /** Where the sprue sits, in model coordinates (the manual spot or the automatic pick). */
  sprueAt: [number, number, number] | null;
  size: [number, number, number];
  fits: boolean;
  /** Lift applied to the tilted model, to map clicks back to model coordinates. */
  zoff: number;
}

/** Reply layout: u32 LE JSON length | JSON | model STL | supports STL. */
export async function printLayout(
  source: string,
  print: PrintParams,
  supports: Support[],
  sprue?: SprueOpts,
): Promise<PrintLayout> {
  const buf = await invoke<ArrayBuffer>("print_layout", { source, print, supports, sprue: sprue ?? null });
  const n = new DataView(buf).getUint32(0, true);
  const info = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n))) as {
    size: [number, number, number];
    fits: boolean;
    modelLen: number;
    supportsLen: number;
    zoff: number;
    sprueAt: [number, number, number] | null;
  };
  const start = 4 + n;
  const supStart = start + info.modelLen;
  const sprueStart = supStart + info.supportsLen;
  return {
    model: buf.slice(start, supStart),
    supports: info.supportsLen > 84 ? buf.slice(supStart, sprueStart) : null,
    sprue: buf.byteLength - sprueStart > 84 ? buf.slice(sprueStart) : null,
    size: info.size,
    fits: info.fits,
    zoff: info.zoff,
    sprueAt: info.sprueAt,
  };
}

/** False when the installation is managed by a package manager (a Linux .deb or .rpm). */
export const canSelfUpdate = () => invoke<boolean>("can_self_update");
