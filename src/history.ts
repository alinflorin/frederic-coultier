import type { FcProject, Snapshot, SnapshotKind } from "./types";

/** Automatic snapshots kept per project; named (manual) ones are never dropped. */
const MAX_AUTO = 40;
/** An agent working in bursts gets one "before" snapshot, not one per edit. */
const AGENT_BURST_MS = 2 * 60_000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const KINDS: SnapshotKind[] = ["manual", "save", "agent", "restore"];

/** Reads the history of a file; anything malformed is skipped. */
export function readHistory(raw: unknown): Snapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is Snapshot =>
        isObject(s) &&
        typeof s.id === "string" &&
        typeof s.source === "string" &&
        typeof s.time === "number" &&
        isObject(s.settings) &&
        isObject(s.supports),
    )
    .map((s) => ({ ...s, label: typeof s.label === "string" ? s.label : "", kind: KINDS.includes(s.kind) ? s.kind : "manual" }));
}

/** Do the two states hold the same design (source, settings and supports)? */
export function sameDesign(a: Pick<FcProject, "source" | "settings" | "supports">, b: Pick<FcProject, "source" | "settings" | "supports">) {
  return a.source === b.source && JSON.stringify(a.settings) === JSON.stringify(b.settings) && JSON.stringify(a.supports) === JSON.stringify(b.supports);
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * The project with a snapshot of its current state added. Automatic kinds are skipped when
 * nothing changed since the latest snapshot; a manual one is always taken.
 */
export function withSnapshot(p: FcProject, kind: SnapshotKind, label = "", now = Date.now()): FcProject {
  const last = p.history[p.history.length - 1];
  if (kind !== "manual" && last && sameDesign(last, p)) return p;
  if (kind === "agent" && last?.kind === "agent" && now - last.time < AGENT_BURST_MS) return p;
  const snap: Snapshot = {
    id: newId(),
    kind,
    label,
    time: now,
    source: p.source,
    settings: structuredClone(p.settings),
    supports: structuredClone(p.supports),
  };
  let list = [...p.history, snap];
  const autos = list.filter((s) => s.kind !== "manual");
  if (autos.length > MAX_AUTO) {
    const drop = new Set(autos.slice(0, autos.length - MAX_AUTO).map((s) => s.id));
    list = list.filter((s) => !drop.has(s.id));
  }
  return { ...p, history: list };
}

/** Puts a snapshot's design back. The state it replaces is snapshotted first, so a restore can be undone. */
export function restoreSnapshot(p: FcProject, id: string): FcProject | null {
  const snap = p.history.find((s) => s.id === id);
  if (!snap) return null;
  const saved = withSnapshot(p, "restore", snap.label || snap.id);
  return {
    ...saved,
    source: snap.source,
    settings: structuredClone(snap.settings),
    supports: structuredClone(snap.supports),
  };
}

export function removeSnapshot(p: FcProject, id: string): FcProject {
  return { ...p, history: p.history.filter((s) => s.id !== id) };
}

export function renameSnapshot(p: FcProject, id: string, label: string): FcProject {
  return { ...p, history: p.history.map((s) => (s.id === id ? { ...s, label } : s)) };
}

export interface DiffLine {
  op: " " | "+" | "-";
  text: string;
}

/** Line diff by longest common subsequence, with only `context` unchanged lines kept around changes. */
export function lineDiff(from: string, to: string, context = 2): DiffLine[] {
  const a = from.split("\n");
  const b = to.split("\n");
  // trim the common head and tail so the table stays small
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const x = a.slice(head, a.length - tail);
  const y = b.slice(head, b.length - tail);
  if (x.length * y.length > 4_000_000) {
    return [...x.map((text) => ({ op: "-" as const, text })), ...y.map((text) => ({ op: "+" as const, text }))];
  }
  const w = y.length + 1;
  const lcs = new Uint32Array((x.length + 1) * w);
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      lcs[i * w + j] = x[i] === y[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }
  const mid: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) mid.push({ op: " ", text: x[i++] }), j++;
    else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) mid.push({ op: "-", text: x[i++] });
    else mid.push({ op: "+", text: y[j++] });
  }
  while (i < x.length) mid.push({ op: "-", text: x[i++] });
  while (j < y.length) mid.push({ op: "+", text: y[j++] });

  const all: DiffLine[] = [
    ...a.slice(Math.max(0, head - context), head).map((text) => ({ op: " " as const, text })),
    ...mid,
    ...a.slice(a.length - tail, a.length - tail + context).map((text) => ({ op: " " as const, text })),
  ];
  return all;
}

export function diffStats(d: DiffLine[]) {
  return { added: d.filter((l) => l.op === "+").length, removed: d.filter((l) => l.op === "-").length };
}
