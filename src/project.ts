import { DEFAULT_SETTINGS } from "./defaults";
import type { ChatMessage, FcProject } from "./types";

/** What the Rust side reads from and writes to a .fc file. */
export interface WireProject {
  source: string;
  settings: unknown;
  chat: unknown;
  supports: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Fills anything missing or mistyped in `loaded` from `defaults`, so older or hand-edited files still open. */
function mergeDeep<T>(defaults: T, loaded: unknown): T {
  if (!isObject(defaults) || !isObject(loaded)) {
    return typeof loaded === typeof defaults && loaded !== null ? (loaded as T) : defaults;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(defaults)) {
    out[key] = mergeDeep(defaults[key], loaded[key]);
  }
  return out as T;
}

const count = (v: unknown) => (typeof v === "number" && v >= 0 ? v : 0);

export function fromWire(w: WireProject): FcProject {
  const sup = isObject(w.supports) ? w.supports : {};
  return {
    formatVersion: 1,
    source: w.source,
    settings: mergeDeep(DEFAULT_SETTINGS, w.settings),
    chat: Array.isArray(w.chat) ? (w.chat as ChatMessage[]) : [],
    supportCount: { auto: count(sup.auto), manual: count(sup.manual) },
  };
}

export function toWire(p: FcProject): WireProject {
  return { source: p.source, settings: p.settings, chat: p.chat, supports: p.supportCount };
}

export const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** A file name that is safe on every OS. */
export const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Untitled";

// --- recent files (per-device convenience, so localStorage is fine) ---

export interface Recent {
  path: string;
  name: string;
}
const RECENT_KEY = "recentProjects";

export function getRecents(): Recent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((r) => typeof r?.path === "string") : [];
  } catch {
    return [];
  }
}

function setRecents(list: Recent[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    // storage unavailable: recents just won't persist
  }
}

export function addRecent(path: string) {
  setRecents([{ path, name: baseName(path) }, ...getRecents().filter((r) => r.path !== path)]);
}

export function removeRecent(path: string) {
  setRecents(getRecents().filter((r) => r.path !== path));
}
