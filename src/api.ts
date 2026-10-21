import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { ExportFormat, FcProject, Support } from "./types";
import { MESH_HEADER, type MeshBuf } from "./components/viewer/geometry";
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
  /** Shaded mesh (see `shadedMesh`), or null when the model has no geometry. */
  mesh: MeshBuf | null;
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

/**
 * Runs the design script in Rhino and returns the model; `tolerance` is the largest distance (mm) between the mesh and
 * the surface. With `refresh` the script is not run: the model is read as it is in Rhino now.
 * Reply layout: u32 LE JSON length | JSON (padded to 4 bytes) | indexed mesh.
 */
export async function renderModel(source: string, tolerance?: number, refresh = false): Promise<RenderResult> {
  let buf: ArrayBuffer;
  try {
    buf = await invoke<ArrayBuffer>(refresh ? "refresh_model" : "render_model", refresh ? { source } : { source, tolerance: tolerance ?? null });
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
    mesh: info.empty ? null : { buf, offset: 4 + jsonLength, length: buf.byteLength - 4 - jsonLength },
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
  /** What was measured at each place in `at` (mm; mm³ for cavities). */
  vals?: number[];
  /** Everything measured, as numbers rather than a sentence. */
  data?: Record<string, unknown>;
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

/** What the extra checks (ring fit, overhang, sprue) need besides the geometry. */
export interface ExtraChecks {
  notes: string;
  tilt: number;
  overhangAngle: number;
  sprue?: SprueOpts;
}

/** The extra checks for a project, with the print settings it has now. */
export function extraChecks(p: FcProject): ExtraChecks {
  const pr = p.settings.printing;
  return {
    notes: p.settings.general.notes,
    tilt: pr.supports.enabled ? pr.tilt : 0,
    overhangAngle: pr.supports.overhangAngle,
    sprue: pr.sprue ? { diameter: pr.sprueDiameter, length: pr.sprueLength, at: pr.sprueAt } : undefined,
  };
}

export const meshReport = (
  source: string,
  simplify?: { keepPercent: number; maxVolumeChange: number },
  checks?: { minWall: number; minGap: number; casting?: boolean },
  extra?: ExtraChecks,
) => invoke<MeshReport>("mesh_report", { source, simplify: simplify ?? null, checks: checks ?? null, extra: extra ? { ...extra, sprue: extra.sprue ?? null } : null });

/** Where the mesh is broken, in model coordinates, to draw over it. */
export interface Health {
  open: [[number, number, number], [number, number, number]][];
  nonManifold: [[number, number, number], [number, number, number]][];
  winding: [[number, number, number], [number, number, number]][];
  degenerate: [number, number, number][];
  truncated: boolean;
}

/** What the surface is like at the point of it nearest to `point` (model coordinates). */
export interface SpotProbe {
  surface: [number, number, number];
  offBy: number;
  normal: [number, number, number];
  thickness: number | null;
  incline: number;
}

export const probePoint = (source: string, point: [number, number, number], tilt: number) =>
  invoke<SpotProbe>("probe_point", { source, point, tilt });

export const meshHealth = (source: string) => invoke<Health>("mesh_health", { source });

/** A line of the script that mentions an object which has a spot of the piece inside its bounding box. */
export interface SourceHit {
  /** Range in the source, in editor (UTF-16) units. */
  from: number;
  to: number;
  line: number;
  column: number;
  endLine: number;
  text: string;
  depth: number;
  /** Always true: kept for the list in the preview. */
  leaf: boolean;
  /** The object's name in Rhino. */
  object: string;
}

/** The lines of `source` that name `name` (as a quoted string), in editor units. */
function linesNaming(source: string, name: string): SourceHit[] {
  if (!name) return [];
  const out: SourceHit[] = [];
  const lines = source.split("\n");
  let at = 0;
  lines.forEach((text, i) => {
    if (text.includes(`"${name}`) || text.includes(`'${name}`)) {
      out.push({ from: at, to: at + text.length, line: i + 1, column: 1, endLine: i + 1, text: text.trim(), depth: 0, leaf: true, object: name });
    }
    at += text.length + 1;
  });
  return out;
}

/** The script lines that make the object(s) of the document at a spot of the piece (model coordinates). */
export async function locateSource(source: string, point: [number, number, number]): Promise<{ hits: SourceHit[]; truncated: boolean }> {
  const objects = await invoke<{ id: string; name: string }[]>("locate_objects", { point });
  const hits = objects.flatMap((o) => linesNaming(source, o.name));
  return { hits, truncated: false };
}

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
  /** Identifies the model and sprue, so the backend can skip them when unchanged. */
  key: string;
  model: MeshBuf;
  /** Supports and raft, null when there are none. */
  supports: MeshBuf | null;
  /** The casting sprue, null when off or no spot was found. */
  sprue: MeshBuf | null;
  /** Where the sprue sits, in model coordinates (the manual spot or the automatic pick). */
  sprueAt: [number, number, number] | null;
  size: [number, number, number];
  fits: boolean;
  /** Lift applied to the tilted model, to map clicks back to model coordinates. */
  zoff: number;
  /** Tilt (degrees about X) the model was printed at in this layout. */
  tilt: number;
}

/**
 * Reply layout: u32 LE JSON length | JSON (padded to 4 bytes) | model mesh | supports mesh | sprue mesh.
 * Given the previous layout, the backend skips the model and sprue when nothing they depend on changed
 * (only supports did); the previous `model` and `sprue` objects are then reused as they are, which also
 * lets the viewer keep the model it already built.
 */
export async function printLayout(
  source: string,
  print: PrintParams,
  supports: Support[],
  sprue?: SprueOpts,
  prev?: PrintLayout | null,
): Promise<PrintLayout> {
  const have = prev ? { key: prev.key, zoff: prev.zoff } : null;
  const buf = await invoke<ArrayBuffer>("print_layout", { source, print, supports, sprue: sprue ?? null, have });
  const n = new DataView(buf).getUint32(0, true);
  const info = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n))) as {
    key: string;
    supportsLen: number;
    // absent when the previous model and sprue are still valid
    size?: [number, number, number];
    fits?: boolean;
    modelLen?: number;
    zoff?: number;
    sprueAt?: [number, number, number] | null;
  };
  const start = 4 + n;
  const modelLen = info.modelLen ?? 0;
  const supStart = start + modelLen;
  const sprueStart = supStart + info.supportsLen;
  const supports_ = info.supportsLen > MESH_HEADER ? { buf, offset: supStart, length: info.supportsLen } : null;
  if (prev && info.modelLen === undefined) return { ...prev, supports: supports_ };
  const tilt = print.tilt;
  return {
    key: info.key,
    model: { buf, offset: start, length: modelLen },
    supports: supports_,
    sprue: buf.byteLength - sprueStart > MESH_HEADER ? { buf, offset: sprueStart, length: buf.byteLength - sprueStart } : null,
    size: info.size as [number, number, number],
    fits: info.fits as boolean,
    zoff: info.zoff as number,
    tilt,
    sprueAt: info.sprueAt ?? null,
  };
}

/** False when the installation is managed by a package manager (a Linux .deb or .rpm). */
export const canSelfUpdate = () => invoke<boolean>("can_self_update");
