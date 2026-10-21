import {
  autoSupports,
  exportModel,
  extraChecks,
  meshHealth,
  meshReport,
  printLayout,
  probePoint,
  renderModel,
  printParams,
  suggestTilt,
  type PrintLayout,
} from "../api";
import type { RenderState } from "../components/PreviewPane";
import { MESH_HEADER, type MeshBuf } from "../components/viewer/geometry";
import type { CaptureOptions, Pin, Viewer } from "../components/viewer/Viewer";
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
  /** The mesh tolerance (mm) the preview is made with. */
  tolerance(): number;
  /** Reads the model from Rhino as it is now (the script is not run) and shows it. */
  refresh(): Promise<void>;
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

/** Triangle count and bounding-box size of a preview mesh (see `shadedMesh`). */
function meshInfo(m: MeshBuf | null): { triangles: number; size: [number, number, number] | null } {
  if (!m || m.length <= MESH_HEADER) return { triangles: 0, size: null };
  const [nv, nt] = new Uint32Array(m.buf, m.offset, 2);
  if (!nt) return { triangles: 0, size: null };
  const p = new Float32Array(m.buf, m.offset + MESH_HEADER, nv * 3);
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i++) {
    const a = i % 3;
    if (p[i] < lo[a]) lo[a] = p[i];
    if (p[i] > hi[a]) hi[a] = p[i];
  }
  return { triangles: nt, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

function renderReply(r: RenderState, status: string) {
  const { triangles, size } = meshInfo(r.mesh);
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

  // the document in Rhino changed (by a Rhino command, or by hand): show what is there now
  "model.refresh": async (api) => {
    open(api);
    await api.refresh();
    const r = api.render();
    return renderReply(r, r.status);
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
      extraChecks(p),
    );
    return {
      units: "mm, mm², mm³",
      ...report,
      metalGrams: +((report.stats.volume / 1000) * DENSITY[s.material.metal]).toFixed(3),
      metal: s.material.metal,
    };
  },

  "analysis.probe": async (api, a) => {
    const p = open(api);
    if (!Array.isArray(a.point) || a.point.length !== 3) throw new Error("point must be [x, y, z]");
    const point = a.point.map((v: unknown, i: number) => num(v, ["x", "y", "z"][i])) as [number, number, number];
    const pr = p.settings.printing;
    return probePoint(p.source, point, pr.supports.enabled ? pr.tilt : 0);
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
    if (a.diff && !a.scene) a.scene = "model"; // the earlier version has no supports or sprue to show
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
      const lay = api.layout();
      const showingPrint = !!lay && (!p.settings.printing.supports.enabled || api.printView());

      // Diagnostics are never part of the picture unless asked for; findings and pins come with a
      // separate copy, so the picture itself stays as rendered.
      const pr = p.settings.printing;
      if (a.overhang) {
        const tilt = ((showingPrint || !pr.supports.enabled ? 0 : pr.tilt) * Math.PI) / 180;
        opts.overhang = { up: showingPrint ? [0, 0, 1] : [0, Math.sin(tilt), Math.cos(tilt)], angle: pr.supports.overhangAngle };
      }
      if (a.health) opts.health = await meshHealth(r.source ?? p.source);
      let report: Awaited<ReturnType<typeof findingsFor>> | null = null;
      if (a.findings || a.annotate) {
        report = await findingsFor(p);
        if (a.annotate) opts.pins = report.pins;
      }
      // an earlier version, rendered from the same camera
      let earlier: { label: string } | null = null;
      if (a.diff) {
        const snap =
          a.diff === true
            ? [...p.history].reverse().find((h) => h.source !== p.source)
            : p.history.find((h) => h.id === a.diff);
        if (!snap) throw new Error(a.diff === true ? "No earlier version differs from the current source; see history." : `no snapshot ${String(a.diff)}; see history`);
        // the old script has to run in Rhino to be seen, which replaces the current objects: run the current one again after
        const old = await renderModel(snap.source, api.tolerance()).catch(() => null);
        await renderModel(p.source, api.tolerance()).catch(() => null);
        if (!old?.mesh) throw new Error("That version does not render (or is empty), so there is nothing to compare with.");
        opts.alt = old.mesh;
        opts.background = opts.background ?? "white"; // a transparent background cannot show a difference
        earlier = { label: snap.label || snap.id };
      }
      if (a.turnaround) {
        const sheet = await turnaround(viewer, opts);
        notes.unshift(showingPrint ? "Scene: as printed." : "Scene: as modelled.");
        notes.push("Views: front, right, back / left, top, iso.");
        return { ...sheet, note: notes.join(" ") };
      }
      const shot = viewer.capture(opts);
      if (earlier) {
        notes.push(`Compared with "${earlier.label}": ${((shot.changed ?? 0) * 100).toFixed(1)}% of the picture differs. Pictures: current, difference in red, earlier version.`);
      }
      notes.unshift(showingPrint ? "Scene: as printed." : "Scene: as modelled.");
      if (a.annotate) {
        notes.push(report && report.pins.length ? "The second picture has numbered pins; the numbers are the findings' n." : "Nothing to pin: no finding has a place on the piece.");
      }
      return { ...shot, note: notes.join(" "), ...(report ? { findings: { bbox: report.bbox, items: report.items } } : {}) };
    } finally {
      if (switched) api.setPrintView(wasPrintView);
    }
  },
};

const SHEET_VIEWS = ["front", "right", "back", "left", "top", "iso"] as const;

const loadImage = (b64: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not compose the picture"));
    img.src = `data:image/png;base64,${b64}`;
  });

/** Six views of the piece on one sheet (3 × 2, labelled), so one picture shows it from all around. */
export async function turnaround(viewer: Viewer, base: CaptureOptions) {
  const tile = 400;
  const aspect = base.width && base.height ? base.height / base.width : 1;
  const tw = tile;
  const th = Math.round(tile * Math.min(Math.max(aspect, 0.5), 2));
  const shots = SHEET_VIEWS.map((view) =>
    viewer.capture({ ...base, alt: undefined, pins: undefined, view, azimuth: undefined, elevation: undefined, width: tw, height: th, background: base.background ?? "white" }),
  );
  const imgs = await Promise.all(shots.map((s) => loadImage(s.png)));
  const canvas = document.createElement("canvas");
  canvas.width = tw * 3;
  canvas.height = th * 2;
  const ctx = canvas.getContext("2d")!;
  const bg = base.background ?? "white";
  if (bg !== "transparent") {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.font = "600 15px sans-serif";
  ctx.textBaseline = "top";
  imgs.forEach((img, i) => {
    const x = (i % 3) * tw;
    const y = Math.floor(i / 3) * th;
    ctx.drawImage(img, x, y);
    ctx.strokeStyle = "#00000022";
    ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
    ctx.fillStyle = bg === "black" ? "#ffffffcc" : "#000000aa";
    ctx.fillText(SHEET_VIEWS[i], x + 8, y + 6);
  });
  return { png: canvas.toDataURL("image/png").split(",")[1], width: canvas.width, height: canvas.height };
}

/** The findings of a deep check, as numbers the agent can use, and the pins that mark them on the piece. */
async function findingsFor(p: FcProject) {
  const s = p.settings;
  const r = await meshReport(p.source, undefined, { minWall: s.printing.minWall, minGap: 0.3, casting: s.material.process === "casting" }, extraChecks(p));
  const shown = r.findings.filter((f) => f.level !== "pass" || f.data);
  let n = 0;
  const pins: Pin[] = [];
  const items = shown.map((f) => {
    // only the ones that point at a place on the piece get a number
    const placed = f.level !== "pass" && !!f.at?.length;
    const id = placed ? ++n : undefined;
    if (id) for (const at of f.at ?? []) pins.push({ at, text: String(id), color: f.level === "fail" ? "#d93025" : f.level === "warn" ? "#e8890c" : "#3b6fd4" });
    return { n: id, level: f.level, code: f.code, detail: f.detail, at: f.at, values: f.vals, data: f.data };
  });
  return { bbox: r.stats.size, items, pins };
}

export async function handle(api: AgentApi, op: string, args: Args): Promise<unknown> {
  const fn = OPS[op];
  if (!fn) throw new Error(`the app does not know the operation ${op}`);
  return fn(api, args);
}
