import { portableBook, readBook } from "./chat/book";
import { DEFAULT_SETTINGS } from "./defaults";
import { getPref, setPref } from "./prefs";
import type { FcProject, Support, SupportsData } from "./types";

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

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);

function readSupports(raw: unknown): SupportsData {
  if (!isObject(raw) || !Array.isArray(raw.list)) return { list: [], nextId: 1 };
  const list = raw.list.filter(
    (s): s is Support => isObject(s) && num(s.id) && num(s.x) && num(s.y) && num(s.z),
  ).map((s) => ({ ...s, source: s.source === "manual" ? "manual" as const : "auto" as const }));
  const nextId = Math.max(num(raw.nextId) ? (raw.nextId as number) : 1, ...list.map((s) => s.id + 1));
  return { list, nextId };
}

export function fromWire(w: WireProject): FcProject {
  return {
    formatVersion: 1,
    source: w.source,
    settings: mergeDeep(DEFAULT_SETTINGS, w.settings),
    supports: readSupports(w.supports),
    chats: readBook(w.chat),
  };
}

export function toWire(p: FcProject): WireProject {
  return { source: p.source, settings: p.settings, chat: { version: 1, ...portableBook(p.chats) }, supports: p.supports };
}

export const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** A file name that is safe on every OS. */
export const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Untitled";

// --- recent files (per-device convenience, kept in the app preferences) ---

export interface Recent {
  path: string;
  name: string;
}
const RECENT_KEY = "recentProjects";

export function getRecents(): Recent[] {
  const raw = getPref<unknown>(RECENT_KEY);
  return Array.isArray(raw) ? raw.filter((r) => typeof r?.path === "string") : [];
}

function setRecents(list: Recent[]) {
  setPref(RECENT_KEY, list.slice(0, 8));
}

export function addRecent(path: string) {
  setRecents([{ path, name: baseName(path) }, ...getRecents().filter((r) => r.path !== path)]);
}

export function removeRecent(path: string) {
  setRecents(getRecents().filter((r) => r.path !== path));
}
