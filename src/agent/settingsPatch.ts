import { DENSITY, ROUGHNESS } from "../materials";
import type { ProjectSettings } from "../types";

/** Allowed values, mirroring the inputs in the settings dialog. */
const RANGES: Record<string, [number, number]> = {
  "render.previewQuality": [12, 256],
  "printing.minWall": [0.2, 3],
  "printing.tilt": [0, 60],
  "printing.supports.tipRadius": [0.1, 1],
  "printing.supports.baseRadius": [0.2, 2],
  "printing.supports.overhangAngle": [0, 80],
  "printing.supports.spacing": [1, 10],
  "printing.supports.raftRadius": [0, 10],
  "printing.supports.lift": [1, 10],
  "printing.hollow.wall": [0.4, 3],
  "printing.hollow.drain": [0.5, 3],
  "printing.sprueDiameter": [0.5, 6],
  "printing.sprueLength": [1, 20],
  "optimization.keepPercent": [1, 99],
  "optimization.maxVolumeChange": [0.1, 5],
};

const ENUMS: Record<string, string[]> = {
  "material.metal": Object.keys(DENSITY),
  "material.process": ["direct", "casting"],
  "render.finish": Object.keys(ROUGHNESS),
  "render.shading": ["shaded", "edges", "wireframe", "xray"],
};

const COLORS = new Set(["render.metalColor", "render.gemColor"]);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export interface PatchResult {
  next: ProjectSettings;
  /** Dotted paths whose value actually changed. */
  changed: string[];
}

/**
 * Merges `patch` into `current`. Throws a message the agent can act on if any key is unknown
 * or any value has the wrong type or is out of range; nothing is applied in that case.
 */
export function applyPatch(current: ProjectSettings, patch: unknown): PatchResult {
  if (!isObject(patch)) throw new Error("patch must be an object such as {\"printing\": {\"tilt\": 20}}");
  const changed: string[] = [];

  const walk = (cur: unknown, p: Record<string, unknown>, path: string): Record<string, unknown> => {
    const base = cur as Record<string, unknown>;
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(p)) {
      const at = path ? `${path}.${key}` : key;
      if (!(key in base)) throw new Error(`unknown setting "${at}"; valid keys here: ${Object.keys(base).join(", ")}`);
      const old = base[key];
      if (isObject(old)) {
        if (!isObject(value)) throw new Error(`"${at}" is a group of settings: pass an object`);
        out[key] = walk(old, value, at);
      } else {
        const v = check(at, old, value);
        if (JSON.stringify(v) !== JSON.stringify(old)) changed.push(at);
        out[key] = v;
      }
    }
    return out;
  };

  const next = walk(current, patch, "") as unknown as ProjectSettings;
  const sup = next.printing.supports;
  if (sup.raftThickness > Math.max(0, sup.lift - 0.1) + 1e-9) {
    throw new Error(`printing.supports.raftThickness (${sup.raftThickness}) must stay below printing.supports.lift (${sup.lift}) by at least 0.1 mm`);
  }
  return { next, changed };
}

function check(path: string, old: unknown, value: unknown): unknown {
  if (path === "printing.sprueAt") {
    if (value === null) return null;
    if (Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n))) return value;
    throw new Error(`"${path}" must be null (automatic) or [x, y, z] in mm`);
  }
  if (typeof old === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`"${path}" must be a number`);
    const r = RANGES[path];
    if (r && (value < r[0] || value > r[1])) throw new Error(`"${path}" must be between ${r[0]} and ${r[1]}, got ${value}`);
    return value;
  }
  if (typeof old === "boolean") {
    if (typeof value !== "boolean") throw new Error(`"${path}" must be true or false`);
    return value;
  }
  if (typeof old === "string") {
    if (typeof value !== "string") throw new Error(`"${path}" must be text`);
    const e = ENUMS[path];
    if (e && !e.includes(value)) throw new Error(`"${path}" must be one of ${e.join(", ")}`);
    if (COLORS.has(path) && !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`"${path}" must be a colour like #d4af37`);
    return value;
  }
  throw new Error(`"${path}" cannot be changed`);
}

// --- the settings reference shown to the agent, built from the same tables that validate ---

const DESCRIPTIONS: Record<string, string> = {
  "general.notes": "free-text notes about the piece",
  "material.metal": "the metal; sets the density, so the weight",
  "material.process": "`casting`: the print is a master for casting; `direct`: printed directly in the final material",
  "render.metalColor": "metal colour in the preview",
  "render.gemColor": "gem colour in the preview",
  "render.finish": "surface finish; changes how shiny the preview is",
  "render.shading": "how the preview is drawn",
  "render.orthographic": "orthographic instead of perspective camera",
  "render.previewQuality": "the `$fn` used while sketching: curve smoothness of the preview",
  "printing.printer": "printer name",
  "printing.minWall": "thinnest wall the checks accept (mm)",
  "printing.tilt": "tilt of the piece about X when printing (degrees)",
  "printing.supports.enabled": "use supports (this also gives the print scene)",
  "printing.supports.tipRadius": "radius of a support's tip where it touches the piece (mm)",
  "printing.supports.baseRadius": "radius of a support where it meets the plate or raft (mm)",
  "printing.supports.overhangAngle": "faces overhanging more than this need support (degrees)",
  "printing.supports.spacing": "distance between automatic supports (mm)",
  "printing.supports.raftRadius": "how far the raft reaches beyond the supports (mm)",
  "printing.supports.raftThickness": "raft thickness, 0 = no raft (mm)",
  "printing.supports.lift": "gap between the piece and the plate (mm)",
  "printing.hollow.enabled": "hollow the piece out when exporting",
  "printing.hollow.wall": "wall thickness left when hollowing (mm)",
  "printing.hollow.drain": "diameter of the drain holes (mm)",
  "printing.sprue": "add a casting sprue",
  "printing.sprueDiameter": "sprue diameter (mm)",
  "printing.sprueLength": "sprue length (mm)",
  "printing.sprueAt": "where the sprue attaches, in model coordinates; null = the app picks the spot",
  "optimization.simplify": "simplify the mesh when exporting",
  "optimization.keepPercent": "percent of the triangles to keep",
  "optimization.maxVolumeChange": "largest volume change a simplification may cause (%)",
};

export interface SettingRow {
  path: string;
  /** What may be set, in words. */
  values: string;
  now: string;
  text: string;
}

function valuesOf(path: string, v: unknown): string {
  if (path === "printing.sprueAt") return "`null` (automatic) or `[x,y,z]`";
  if (path === "printing.supports.raftThickness") return "0 to lift−0.1";
  if (typeof v === "number") {
    const r = RANGES[path];
    return r ? `${r[0]}–${r[1]}` : "number";
  }
  if (typeof v === "boolean") return "true/false";
  if (ENUMS[path]) return ENUMS[path].join(", ");
  if (COLORS.has(path)) return "#rrggbb";
  return "text";
}

/** Every setting that can be changed: its path, allowed values, current value and meaning. */
export function describeSettings(settings: ProjectSettings): SettingRow[] {
  const rows: SettingRow[] = [];
  const walk = (node: unknown, path: string) => {
    if (isObject(node)) {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
      return;
    }
    if (path === "general.name") return; // the name is the file name
    rows.push({
      path,
      values: valuesOf(path, node),
      now: node === null ? "null" : typeof node === "string" ? node : JSON.stringify(node),
      text: DESCRIPTIONS[path] ?? "",
    });
  };
  walk(settings, "");
  return rows;
}
