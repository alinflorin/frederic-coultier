import {
  autoSupports,
  exportModel,
  meshReport,
  printLayout,
  printParams,
  suggestTilt,
  type PrintLayout,
} from "../api";
import type { RenderState } from "../components/PreviewPane";
import type { CaptureOptions, Viewer } from "../components/viewer/Viewer";
import { DENSITY } from "../materials";
import type { ExportFormat, FcProject, Support } from "../types";
import { DEFAULT_SETTINGS } from "../defaults";
import { restoreSnapshot, withSnapshot } from "../history";
import { applyPatch, describeSettings } from "./settingsPatch";
import { chimeOn, playChime } from "../chime";

/** What the agent's operations need from the running app. Every getter returns the latest value. */
export interface AgentApi {
  project(): FcProject | null;
  path(): string | null;
  docName(): string;
  dirty(): boolean;
  /** Bumped on every change of the source. */
  rev(): number;
  render(): RenderState;
  layout(): PrintLayout | null;
  /** True while the print layout is being recomputed. */
  layoutPending(): boolean;
  printView(): boolean;
  setPrintView(v: boolean): void;
  viewer(): Viewer | null;
  edit(fn: (p: FcProject) => FcProject): void;
  /** Replaces the open project as a whole (not an edit of the source, so no "before agent" snapshot). */
  replace(next: FcProject): void;
  save(): Promise<boolean>;
  /** Replaces the open project with a new empty one (or the sample ring). */
  newProject(sample: boolean): void;
  /** Opens a .fc file, replacing the open project. Rejects with the reason if it can't. */
  openFile(path: string): Promise<void>;
  /** Saves to `path` (Save As) and makes it the project's file. Resolves to the path written. */
  saveTo(path: string): Promise<string>;
}

type Args = Record<string, any>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** New and Open replace the project: never silently throw the user's unsaved work away. */
function requireDiscard(api: AgentApi, discard: unknown) {
  if (api.project() && api.dirty() && !discard) {
    throw new Error("The open project has unsaved changes. Save it with save-project, or add --discard to throw them away.");
  }
}

function open(api: AgentApi): FcProject {
  const p = api.project();
  if (!p) throw new Error("No project is open in the app. Ask the user to open or create one.");
  return p;
}

const num = (v: unknown, name: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${name} must be a number`);
  return v;
};

// --- render state ---

/** Triangle count and bounding-box size of a binary STL. */
function stlInfo(buf: ArrayBuffer | null): { triangles: number; size: [number, number, number] | null } {
  if (!buf || buf.byteLength < 84) return { triangles: 0, size: null };
  const view = new DataView(buf);
  const n = Math.min(view.getUint32(80, true), Math.floor((buf.byteLength - 84) / 50));
  if (n === 0) return { triangles: 0, size: null };
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let t = 0; t < n; t++) {
    const base = 84 + t * 50 + 12; // skip the normal
    for (let v = 0; v < 3; v++) {
      for (let a = 0; a < 3; a++) {
        const x = view.getFloat32(base + v * 12 + a * 4, true);
        if (x < lo[a]) lo[a] = x;
        if (x > hi[a]) hi[a] = x;
      }
    }
  }
  return { triangles: n, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

function renderReply(r: RenderState, status: string) {
  const { triangles, size } = stlInfo(r.mesh);
  return {
    status,
    ms: r.ms ?? null,
    triangles,
    size,
    error: r.status === "error" && r.error ? { message: r.error.message, line: r.error.line ?? null, column: r.error.column ?? null } : null,
    diagnostics: r.diagnostics,
    echoes: r.echoes,
  };
}

/** Resolves once the preview shows the current source (rendered or failed), or on timeout. */
async function waitRender(api: AgentApi, timeoutMs: number) {
  const t0 = performance.now();
  for (;;) {
    const p = open(api);
    const r = api.render();
    const current = r.source === p.source && (r.status === "ok" || r.status === "error");
    if (current) return renderReply(r, r.status);
    if (performance.now() - t0 >= timeoutMs) return renderReply(r, timeoutMs > 0 ? "timeout" : r.source === p.source ? r.status : "stale");
    await sleep(40);
  }
}

/** Waits for the render and the print layout to catch up with the latest change. */
async function settle(api: AgentApi, timeoutMs = 20000) {
  await frame();
  await frame(); // React has committed the change and started the effects
  const t0 = performance.now();
  await waitRender(api, timeoutMs);
  await frame();
  await frame(); // the layout effect starts once the render result is in
  while (api.layoutPending() && performance.now() - t0 < timeoutMs) await sleep(40);
}

// --- print layout, computed the same way the preview does it ---

function layoutInputs(p: FcProject) {
  const pr = p.settings.printing;
  const sup = pr.supports;
  const params = sup.enabled ? printParams(pr.tilt, sup) : { ...printParams(0, sup), lift: 0, raft: 0 };
  const sprue = pr.sprue ? { diameter: pr.sprueDiameter, length: pr.sprueLength, at: pr.sprueAt } : undefined;
  return { params, supports: sup.enabled ? p.supports.list : [], sprue };
}

async function freshLayout(p: FcProject): Promise<PrintLayout> {
  const { params, supports, sprue } = layoutInputs(p);
  return printLayout(p.source, params, supports, sprue);
}

function supportSummary(p: FcProject) {
  const list = p.supports.list;
  const auto = list.filter((s) => s.source === "auto").length;
  return { total: list.length, auto, manual: list.length - auto };
}

// --- operations ---

type Handler = (api: AgentApi, a: Args) => Promise<unknown> | unknown;

const OPS: Record<string, Handler> = {
  "app.chime": () => ({ played: chimeOn() && (playChime(), true) }),

  "project.info": (api) => {
    const p = api.project();
    if (!p) return { open: false };
    const pr = p.settings.printing;
    const r = api.render();
    return {
      open: true,
      name: api.docName(),
      path: api.path(),
      unsavedChanges: api.dirty(),
      sourceLines: p.source === "" ? 0 : p.source.replace(/\n$/, "").split("\n").length,
      preview: r.source === p.source ? r.status : r.status === "idle" ? "idle" : "rendering",
      material: p.settings.material,
      supports: { enabled: pr.supports.enabled, ...supportSummary(p), tilt: pr.tilt },
      sprue: { enabled: pr.sprue, diameter: pr.sprueDiameter, length: pr.sprueLength, at: pr.sprueAt },
      hollow: pr.hollow,
      notes: p.settings.general.notes,
    };
  },

  "project.new": (api, a) => {
    requireDiscard(api, a.discard);
    api.newProject(!!a.sample);
    return { created: true, sample: !!a.sample };
  },

  "project.open": async (api, a) => {
    if (typeof a.path !== "string") throw new Error("path must be text");
    requireDiscard(api, a.discard);
    await api.openFile(a.path);
    return { path: a.path };
  },

  "project.save": async (api, a) => {
    open(api);
    if (typeof a.path === "string") return { path: await api.saveTo(a.path) };
    const path = api.path();
    if (!path) throw new Error("This project has never been saved. The user has to choose a file name first (File → Save).");
    if (!(await api.save())) throw new Error("Saving failed.");
    return { path };
  },

  "history.list": (api) => ({
    list: [...open(api).history].reverse().map((s) => ({ id: s.id, time: new Date(s.time).toLocaleString(), kind: s.kind, label: s.label })),
  }),

  "history.snapshot": (api, a) => {
    const p = open(api);
    const next = withSnapshot(p, "manual", typeof a.label === "string" ? a.label.trim() : "");
    api.replace(next);
    return { id: next.history[next.history.length - 1].id };
  },

  "history.restore": async (api, a) => {
    const p = open(api);
    const snap = p.history.find((s) => s.id === a.id);
    if (!snap) throw new Error(`no snapshot ${String(a.id)}; see history`);
    const next = restoreSnapshot(p, snap.id);
    if (!next) throw new Error("could not restore");
    api.replace(next);
    await settle(api);
    return { restored: snap.label || snap.id, undo: next.history[next.history.length - 1].id };
  },

  "source.get": (api) => ({ source: open(api).source, rev: api.rev() }),

  "source.set": (api, a) => {
    const p = open(api);
    if (typeof a.source !== "string") throw new Error("source must be text");
    if (a.expectRev !== undefined && a.expectRev !== api.rev()) throw new Error("conflict: the source changed since it was read");
    if (a.source !== p.source) api.edit((q) => ({ ...q, source: a.source }));
    return { rev: api.rev() };
  },

  "render.wait": (api, a) => waitRender(api, Math.max(0, Math.min(Number(a.timeoutMs) || 0, 120000))),

  "settings.get": (api) => open(api).settings,

  // works without a project: the rows then show the defaults
  "settings.schema": (api) => describeSettings(api.project()?.settings ?? DEFAULT_SETTINGS),

  "settings.patch": async (api, a) => {
    const p = open(api);
    const { next, changed } = applyPatch(p.settings, a.patch);
    if (changed.length) {
      api.edit((q) => ({ ...q, settings: next }));
      await settle(api);
    }
    return { changed, settings: next };
  },

  "analysis.report": async (api, a) => {
    const p = open(api);
    const s = p.settings;
    const report = await meshReport(
      p.source,
      a.simplifyPreview ? { keepPercent: s.optimization.keepPercent, maxVolumeChange: s.optimization.maxVolumeChange } : undefined,
      a.deepChecks ? { minWall: s.printing.minWall, minGap: 0.3, casting: s.material.process === "casting" } : undefined,
    );
    return {
      units: "mm, mm², mm³",
      ...report,
      metalGrams: +((report.stats.volume / 1000) * DENSITY[s.material.metal]).toFixed(3),
      metal: s.material.metal,
    };
  },

  "analysis.tilt": async (api) => {
    const p = open(api);
    const sup = p.settings.printing.supports;
    const rows = await suggestTilt(p.source, sup.overhangAngle, sup.lift);
    return { current: p.settings.printing.tilt, best: rows[0] ?? null, rows };
  },

  "supports.get": async (api) => {
    const p = open(api);
    const pr = p.settings.printing;
    const lay = await freshLayout(p);
    return {
      enabled: pr.supports.enabled,
      tilt: pr.tilt,
      ...supportSummary(p),
      nextId: p.supports.nextId,
      list: p.supports.list,
      printer: pr.printer,
      printedSize: lay.size,
      fitsPrinter: lay.fits,
    };
  },

  "supports.auto": async (api, a) => {
    const p = open(api);
    const pr = p.settings.printing;
    if (!pr.supports.enabled) {
      throw new Error('Supports are turned off. Enable them first with settings_update {"printing": {"supports": {"enabled": true}}}.');
    }
    const sup = { ...pr.supports };
    if (a.overhang_angle !== undefined) sup.overhangAngle = num(a.overhang_angle, "overhang_angle");
    if (a.spacing !== undefined) sup.spacing = num(a.spacing, "spacing");
    const manual = p.supports.list.filter((s) => s.source === "manual");
    const r = await autoSupports(p.source, printParams(pr.tilt, sup), sup, manual, p.supports.nextId);
    api.edit((q) => ({ ...q, supports: { list: r.supports, nextId: r.nextId } }));
    await settle(api);
    return { ...r.stats, kept: manual.length, total: r.supports.length };
  },

  "supports.add": async (api, a) => {
    const p = open(api);
    if (!Array.isArray(a.points) || a.points.length === 0) throw new Error("points must be a non-empty list");
    let id = p.supports.nextId;
    const added: Support[] = a.points.map((pt: Args) => ({
      id: id++,
      x: num(pt.x, "x"),
      y: num(pt.y, "y"),
      z: num(pt.z, "z"),
      source: "manual" as const,
      ...(pt.tip !== undefined ? { tip: num(pt.tip, "tip") } : {}),
    }));
    api.edit((q) => ({ ...q, supports: { list: [...q.supports.list, ...added], nextId: id } }));
    await settle(api);
    return { added: added.map((s) => s.id), enabled: p.settings.printing.supports.enabled };
  },

  "supports.remove": async (api, a) => {
    const p = open(api);
    const ids: number[] | undefined = Array.isArray(a.ids) ? a.ids : undefined;
    const kind: string | undefined = a.kind;
    const doomed = new Set(
      p.supports.list.filter((s) => (ids ? ids.includes(s.id) : false) || kind === "all" || (kind !== undefined && s.source === kind)).map((s) => s.id),
    );
    if (ids) {
      const missing = ids.filter((i) => !p.supports.list.some((s) => s.id === i));
      if (missing.length) throw new Error(`no support with id ${missing.join(", ")}`);
    }
    if (doomed.size) {
      api.edit((q) => ({ ...q, supports: { ...q.supports, list: q.supports.list.filter((s) => !doomed.has(s.id)) } }));
      await settle(api);
    }
    return { removed: [...doomed], remaining: p.supports.list.length - doomed.size };
  },

  "sprue.set": async (api, a) => {
    const p = open(api);
    const printing: Args = {};
    if (a.enabled !== undefined) printing.sprue = a.enabled;
    if (a.diameter !== undefined) printing.sprueDiameter = a.diameter;
    if (a.length !== undefined) printing.sprueLength = a.length;
    if (a.at !== undefined) printing.sprueAt = a.at;
    if (a.auto) printing.sprueAt = null;
    const { next, changed } = applyPatch(p.settings, { printing });
    if (changed.length) {
      api.edit((q) => ({ ...q, settings: next }));
      await settle(api);
    }
    const q = api.project() ?? p;
    const pr = q.settings.printing;
    let at = pr.sprueAt;
    let placed: boolean | null = null;
    if (pr.sprue) {
      const lay = await freshLayout(q);
      at = lay.sprueAt;
      placed = lay.sprue !== null;
    }
    return { enabled: pr.sprue, diameter: pr.sprueDiameter, length: pr.sprueLength, at, manualSpot: pr.sprueAt !== null, placed };
  },

  "export.run": async (api, a) => {
    const p = open(api);
    const pr = p.settings.printing;
    const o = p.settings.optimization;
    const withSupports = (a.supports ?? pr.supports.enabled) && pr.supports.enabled && p.supports.list.length > 0;
    await exportModel(p.source, a.path, a.format as ExportFormat, {
      print: withSupports ? { params: printParams(pr.tilt, pr.supports), supports: p.supports.list } : undefined,
      simplify: (a.simplify ?? o.simplify) ? { keepPercent: o.keepPercent, maxVolumeChange: o.maxVolumeChange } : undefined,
      hollow: (a.hollow ?? pr.hollow.enabled) ? { wall: pr.hollow.wall, drain: pr.hollow.drain, tilt: pr.tilt } : undefined,
      sprue: (a.sprue ?? pr.sprue) ? { diameter: pr.sprueDiameter, length: pr.sprueLength, at: pr.sprueAt } : undefined,
    });
    return { path: a.path, format: a.format, supportsBakedIn: withSupports };
  },

  "view.capture": async (api, a) => {
    const p = open(api);
    const viewer = api.viewer();
    if (!viewer) throw new Error("The 3D preview is not available (is the preview pane visible, and WebGL working?).");
    await settle(api);
    const r = api.render();
    if (r.status === "error" && !r.mesh) throw new Error("The model does not render yet, so there is nothing to photograph. Fix the source error first.");

    // which scene: the piece as modelled, or as printed
    const notes: string[] = [];
    const wasPrintView = api.printView();
    let switched = false;
    if (a.scene) {
      const wantPrint = a.scene === "print";
      const supOn = p.settings.printing.supports.enabled;
      if (wantPrint && !api.layout()) {
        notes.push("No print scene: turn on supports or the sprue to get one. Showing the model.");
      } else if (!wantPrint && !supOn && api.layout()) {
        notes.push("With supports off the sprue is part of the scene; showing it.");
      } else if (supOn && wantPrint !== wasPrintView) {
        api.setPrintView(wantPrint);
        switched = true;
        await frame();
        await frame();
        await sleep(30);
      }
    }
    try {
      const opts: CaptureOptions = {
        view: a.view,
        azimuth: a.azimuth,
        elevation: a.elevation,
        zoom: a.zoom,
        target: a.target,
        orthographic: a.orthographic,
        shading: a.shading,
        grid: a.grid,
        axes: a.axes,
        dimensions: a.dimensions,
        metalColor: a.metal_color,
        background: a.background,
        width: a.width,
        height: a.height,
      };
      if (a.section) {
        const t = num(a.section.position, "section.position");
        opts.section = { axis: a.section.axis, t: Math.min(1, Math.max(0, t)), flip: !!a.section.flip };
      }
      for (const k of ["zoom", "azimuth", "elevation"] as const) if (opts[k] !== undefined) num(opts[k], k);
      const shot = viewer.capture(opts);
      const lay = api.layout();
      const showingPrint = !!lay && (!p.settings.printing.supports.enabled || api.printView());
      notes.unshift(showingPrint ? "Scene: as printed." : "Scene: as modelled.");
      return { ...shot, note: notes.join(" ") };
    } finally {
      if (switched) api.setPrintView(wasPrintView);
    }
  },
};

export async function handle(api: AgentApi, op: string, args: Args): Promise<unknown> {
  const fn = OPS[op];
  if (!fn) throw new Error(`the app does not know the operation ${op}`);
  return fn(api, args);
}
