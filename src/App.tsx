import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Affix, Box, Group, Paper, Text, UnstyledButton } from "@mantine/core";
import { useHover, useMediaQuery } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { check } from "@tauri-apps/plugin-updater";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  RenderError,
  type PrintLayout,
  exportModel,
  inTauri,
  canSelfUpdate,
  openProject,
  pickExportPath,
  pickProjectToOpen,
  pickProjectToSave,
  printLayout,
  printParams,
  renderScad,
  saveProject,
} from "./api";
import { emptyProject, sampleProject } from "./defaults";
import { removeSnapshot, renameSnapshot, restoreSnapshot, withSnapshot } from "./history";
import { HistoryDialog } from "./components/HistoryDialog";
import { addRecent, baseName, fromWire, getRecents, removeRecent, toWire } from "./project";
import type { Attached, ExportFormat, FcProject, ProjectSettings, SnapshotKind, SupportsData } from "./types";
import { MenuBar, type Menu } from "./components/MenuBar";
import { SourcePane } from "./components/SourcePane";
import { ChatPane } from "./components/ChatPane";
import { PreviewPane, type RenderState } from "./components/PreviewPane";
import { SettingsDialog } from "./components/SettingsDialog";
import { ExportDialog } from "./components/ExportDialog";
import { PreferencesDialog } from "./components/PreferencesDialog";
import { getPref, setPref } from "./prefs";
import { KbDialog } from "./components/KbDialog";
import { AboutDialog } from "./components/AboutDialog";
import { McpIndicator } from "./components/McpIndicator";
import { ConfirmDialog } from "./components/ConfirmDialog";
import type { ExportPick } from "./components/ExportDialog";
import { Onboarding } from "./components/Onboarding";
import { Welcome } from "./components/Welcome";
import { Icon } from "./components/Icon";
import type { Viewer } from "./components/viewer/Viewer";
import { useAgentBridge } from "./agent/useAgentBridge";
import { listEngines, type EngineInfo } from "./chat/engines";
import { useAgentChat } from "./chat/useAgentChat";
import type { AgentApi } from "./agent/ops";

type PaneId = "source" | "chat" | "preview";
const RELEASES_URL = "https://github.com/alinflorin/frederic-coultier/releases/latest";

type DialogId = "settings" | "export" | "history" | "prefs" | "kb" | "about" | null;

const IDLE: RenderState = { status: "idle", mesh: null, diagnostics: [], echoes: [] };
const RENDER_DELAY_MS = 200;

/** The draggable bar between two panes. */
function Handle({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  const { hovered, ref } = useHover<HTMLDivElement>();
  return (
    <Box
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      bg={hovered ? "var(--accent)" : "var(--border)"}
      style={{ cursor: "col-resize", opacity: hovered ? 1 : 0.5, transition: "opacity 0.15s, background 0.15s", touchAction: "none" }}
    />
  );
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e));

function App() {
  const { t } = useTranslation();
  const compact = useMediaQuery("(max-width: 899px)", false, { getInitialValueInEffect: false });

  // `project` is the in-memory content of the open .fc file, `path` where it lives on disk.
  const [project, setProject] = useState<FcProject | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Bumped whenever a different project is loaded, so the preview starts with a fresh camera.
  const [projectId, setProjectId] = useState(0);

  const [dialog, setDialog] = useState<DialogId>(null);
  const [pending, setPending] = useState<{ next: () => void } | null>(null);
  // Pictures and files waiting to go with the next chat message (the preview can add a drawing).
  const [draftFiles, setDraftFiles] = useState<Attached[]>([]);
  const [updateReady, setUpdateReady] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // The chat pane is on unless turned off (Preferences > Agent Chat, or the first-run choice).
  const [chatEnabled, setChatEnabledState] = useState(() => getPref<boolean>("chatEnabled") !== false);
  // Shown once per install, also to people upgrading from a version without it.
  const [onboarding, setOnboarding] = useState(() => getPref<boolean>("onboarded") !== true);
  const [autoUpdate, setAutoUpdateState] = useState(() => getPref<boolean>("autoUpdate") !== false);
  const [selfUpdate, setSelfUpdate] = useState(true);
  useEffect(() => {
    if (inTauri()) canSelfUpdate().then(setSelfUpdate).catch(() => {});
  }, []);
  const setAutoUpdate = (on: boolean) => {
    setPref("autoUpdate", on);
    setAutoUpdateState(on);
  };
  const setChatEnabled = (on: boolean) => {
    setPref("chatEnabled", on);
    setChatEnabledState(on);
    if (!on) setMobilePane((p) => (p === "chat" ? "source" : p));
  };
  // Which agents can answer (installed and signed in), and which one the user picked.
  const [engines, setEngines] = useState<EngineInfo[] | null>(null);
  const [engineChoice, setEngineChoice] = useState(() => getPref<string>("chatEngine") ?? null);
  const refreshEngines = useCallback(() => listEngines().then(setEngines), []);
  useEffect(() => {
    void refreshEngines();
  }, [refreshEngines]);
  const setChatEngine = (id: string) => {
    setPref("chatEngine", id);
    setEngineChoice(id);
  };
  const engine = engines?.find((e) => e.available && e.id === engineChoice) ?? engines?.find((e) => e.available) ?? null;
  // Model and thinking level, remembered for each agent. Empty means the agent's own choice.
  const [picks, setPicks] = useState<Record<string, { model?: string; effort?: string }>>(
    () => getPref("chatPicks") ?? {},
  );
  const [overrides, setOverrides] = useState<Record<string, { model?: string; effort?: string }>>({});
  const [mobilePane, setMobilePane] = useState<PaneId>("source");
  const [cols, setCols] = useState(() => {
    // source, chat and preview start a third of the window each
    const side = Math.max(300, Math.floor((window.innerWidth - 12) / 3));
    return { source: side, preview: side };
  });
  const [render, setRender] = useState<RenderState>(IDLE);
  const [layout, setLayout] = useState<PrintLayout | null>(null);
  const [printView, setPrintView] = useState(true);
  /** The statement that makes the spot clicked with the "find in source" tool. */
  const [sourceHit, setSourceHit] = useState<{ from: number; to: number } | null>(null);
  const [triangles, setTriangles] = useState<number | null>(null);
  const [recents, setRecents] = useState(getRecents);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // The latest project, readable at any moment (state only updates on the next render). Every
  // change goes through `commit`, which also counts source revisions for the agent's conflict check.
  const projectRef = useRef<FcProject | null>(null);
  const revRef = useRef(0);
  const commit = useCallback((next: FcProject | null) => {
    const prev = projectRef.current;
    if (!next || !prev || prev.source !== next.source) revRef.current++;
    projectRef.current = next;
    setProject(next);
  }, []);

  const edit = useCallback(
    (fn: (p: FcProject) => FcProject) => {
      const p = projectRef.current;
      if (p) commit(fn(p));
      setDirty(true);
    },
    [commit],
  );

  /** Adds a snapshot of the current design to the history (not a change the user needs to save). */
  const snapshot = useCallback(
    (kind: SnapshotKind, label = "") => {
      const p = projectRef.current;
      if (!p) return null;
      const next = withSnapshot(p, kind, label);
      if (next !== p) commit(next);
      return next;
    },
    [commit],
  );

  // Defaults come from Preferences; the chat panel can override them until the app closes.
  const defaults = (engine && picks[engine.id]) || {};
  const override = (engine && overrides[engine.id]) || {};
  const models = engine?.models ?? [];
  const settle = (model: string | undefined, effort: string | undefined) => {
    const m = models.find((x) => x.id === model);
    const efforts = m ? m.efforts : (engine?.efforts ?? []);
    return { model: m?.id ?? "", efforts, effort: effort && efforts.includes(effort) ? effort : "" };
  };
  const pref = settle(defaults.model, defaults.effort);
  const active = settle(override.model ?? pref.model, override.effort ?? pref.effort);
  const setDefault = (change: { model?: string; effort?: string }) => {
    if (!engine) return;
    const next = { ...picks, [engine.id]: { ...defaults, ...change } };
    setPicks(next);
    setPref("chatPicks", next);
  };
  const setOverride = (change: { model?: string; effort?: string }) => {
    if (engine) setOverrides((o) => ({ ...o, [engine.id]: { ...override, ...change } }));
  };
  const chat = useAgentChat({
    projectRef,
    engine: engine?.id ?? null,
    model: active.model,
    effort: active.effort,
    path,
    projectId,
    onLite: (chats) => edit((p) => ({ ...p, chats })),
  });
  const noAgent = engines === null ? t("chat.checking") : engine ? null : t("chat.noAgent");

  const load = (p: FcProject, filePath: string | null) => {
    commit(p);
    setPath(filePath);
    setDirty(false);
    setRender(IDLE);
    setLayout(null);
    setProjectId((n) => n + 1);
  };

  // --- rendering: re-render shortly after the source stops changing ---
  const source = project?.source;
  const request = useRef(0);
  useEffect(() => {
    if (source === undefined) return;
    const id = ++request.current;
    setRender((r) => ({ ...r, status: "rendering" }));
    const timer = setTimeout(async () => {
      try {
        const res = await renderScad(source);
        if (id !== request.current) return;
        setRender({ status: "ok", mesh: res.mesh, ms: res.ms, diagnostics: res.diagnostics, echoes: res.echoes, source });
      } catch (e) {
        if (id !== request.current) return;
        // keep showing the last good model while the source is broken
        setRender((r) => ({
          ...r,
          status: "error",
          error: e instanceof RenderError ? e : new RenderError(errorText(e)),
          source,
        }));
      }
    }, RENDER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [source, projectId]);

  // --- print layout: tilted piece with supports, refreshed when anything it depends on changes ---
  const supOpts = project?.settings.printing.supports;
  const tilt = project?.settings.printing.tilt ?? 0;
  const supList = project?.supports.list;
  const sprueOn = project?.settings.printing.sprue ?? false;
  const sprueD = project?.settings.printing.sprueDiameter ?? 2;
  const sprueL = project?.settings.printing.sprueLength ?? 5;
  const sprueAt = project?.settings.printing.sprueAt ?? null;
  const layoutPending = useRef(false);
  const layoutRef = useRef<PrintLayout | null>(null);
  layoutRef.current = layout;
  useEffect(() => {
    if (!supOpts || !(supOpts.enabled || sprueOn) || !source || render.status !== "ok" || !render.mesh) {
      setLayout(null);
      layoutPending.current = false;
      return;
    }
    layoutPending.current = true;
    let live = true;
    // without supports the piece stays as modelled; the layout then only adds the sprue
    const params = supOpts.enabled ? printParams(tilt, supOpts) : { ...printParams(0, supOpts), lift: 0, raft: 0 };
    printLayout(source, params, supOpts.enabled ? (supList ?? []) : [], sprueOn ? { diameter: sprueD, length: sprueL, at: sprueAt } : undefined, layoutRef.current)
      .then((l) => {
        if (!live) return;
        setLayout(l);
        layoutPending.current = false;
      })
      .catch((e) => {
        if (!live) return;
        layoutPending.current = false;
        setLayout(null);
        console.error("print layout failed", e);
        notify(t("preview.layoutFailed", { error: errorText(e) }));
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render.mesh, render.status, supOpts, tilt, supList, sprueOn, sprueD, sprueL, sprueAt]);

  // --- file actions ---
  const loadPath = async (p: string) => {
    try {
      load(fromWire(await openProject(p)), p);
      addRecent(p);
    } catch (e) {
      removeRecent(p);
      notify(t("file.openFailed", { error: errorText(e) }));
    }
    setRecents(getRecents());
  };

  const doSaveAs = async (): Promise<boolean> => {
    if (!project) return false;
    try {
      const target = await pickProjectToSave(docName);
      if (!target) return false;
      const written = await saveProject(target, toWire(snapshot("save") ?? project));
      setPath(written);
      setDirty(false);
      addRecent(written);
      setRecents(getRecents());
      notify(t("file.saved", { name: baseName(written) }));
      return true;
    } catch (e) {
      notify(t("file.saveFailed", { error: errorText(e) }));
      return false;
    }
  };

  const doSave = async (): Promise<boolean> => {
    if (!project) return false;
    if (!path) return doSaveAs();
    try {
      await saveProject(path, toWire(snapshot("save") ?? project));
      setDirty(false);
      notify(t("file.saved", { name: baseName(path) }));
      return true;
    } catch (e) {
      notify(t("file.saveFailed", { error: errorText(e) }));
      return false;
    }
  };

  /** Runs `next` now, or after the user has dealt with unsaved changes. */
  const guard = (next: () => void) => (dirty && project ? setPending({ next }) : next());

  const newProject = () => guard(() => load(emptyProject(t("file.untitled")), null));
  const newSample = () =>
    guard(() => {
      load(sampleProject(), null);
      setDirty(true); // never saved yet
    });
  const openDialog = () =>
    guard(async () => {
      try {
        const p = await pickProjectToOpen();
        if (p) await loadPath(p);
      } catch (e) {
        notify(t("file.openFailed", { error: errorText(e) }));
      }
    });
  const openRecent = (p: string) => guard(() => void loadPath(p));
  const closeProject = () =>
    guard(() => {
      request.current++;
      commit(null);
      setPath(null);
      setDirty(false);
      setDialog(null);
      setRender(IDLE);
      setTriangles(null);
    });

  const doExport = async (format: ExportFormat, pick: ExportPick) => {
    if (!project) return;
    setDialog(null);
    try {
      const target = await pickExportPath(docName, format);
      if (!target) return;
      const pr = project.settings.printing;
      const o = project.settings.optimization;
      await exportModel(project.source, target, format, {
        print:
          pick.supports && pr.supports.enabled && project.supports.list.length > 0
            ? { params: printParams(pr.tilt, pr.supports), supports: project.supports.list }
            : undefined,
        simplify: pick.simplify ? { keepPercent: o.keepPercent, maxVolumeChange: o.maxVolumeChange } : undefined,
        hollow: pick.hollow ? { wall: pr.hollow.wall, drain: pr.hollow.drain, tilt: pr.tilt } : undefined,
        sprue: pick.sprue ? { diameter: pr.sprueDiameter, length: pr.sprueLength, at: pr.sprueAt } : undefined,
      });
      notify(t("export.done", { file: baseName(target) }));
    } catch (e) {
      notify(t("file.exportFailed", { error: errorText(e) }));
    }
  };

  // `silent` is the startup check: no toasts unless an update was installed.
  // Installing never restarts by itself; the restart goes through the unsaved-work guard.
  const restartToUpdate = () => (dirtyRef.current ? setPending({ next: () => void relaunch() }) : void relaunch());
  async function checkForUpdates(silent = false) {
    try {
      const update = await check();
      if (!update) return silent ? undefined : notify(t("upToDate"));
      if (!(await canSelfUpdate())) {
        // installed through a package manager: tell, but leave the install to it
        notify(t("updateAvailable", { version: update.version }));
        if (!silent) await openUrl(RELEASES_URL);
        return;
      }
      if (!silent) notify(t("downloading", { version: update.version }));
      await update.downloadAndInstall();
      setUpdateReady(update.version);
      if (silent) notify(t("updateReady", { version: update.version }));
      else restartToUpdate();
    } catch (e) {
      if (!silent) notify(errorText(e));
    }
  }
  useEffect(() => {
    if (!inTauri() || !import.meta.env.PROD || !autoUpdate) return;
    const id = setTimeout(() => void checkForUpdates(true), 5000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- window title, and asking before the window closes with unsaved work ---
  const title = project ? (path ? baseName(path) : t("file.untitled")) : "";
  const docName = path ? baseName(path).replace(/\.fc$/i, "") : t("file.untitled");
  useEffect(() => {
    if (!inTauri()) return;
    const name = title ? `${dirty ? "● " : ""}${title} — Frederic Coultier` : "Frederic Coultier";
    getCurrentWindow().setTitle(name).catch(() => {});
  }, [title, dirty]);

  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!inTauri()) return;
    let off: (() => void) | undefined;
    getCurrentWindow()
      .onCloseRequested((e) => {
        if (!dirtyRef.current) return;
        e.preventDefault();
        setPending({ next: () => void getCurrentWindow().destroy() });
      })
      .then((u) => (off = u));
    return () => off?.();
  }, []);

  // --- agent: the MCP tools read and change the live project through this ---
  const viewerRef = useRef<Viewer | null>(null);
  const live = useRef({ path, dirty, docName, render, layout, printView });
  live.current = { path, dirty, docName, render, layout, printView };
  const saveRef = useRef(doSave);
  saveRef.current = doSave;
  const actions = useRef({} as Pick<AgentApi, "newProject" | "openFile" | "saveTo">);
  actions.current = {
    newProject: (sample) => {
      load(sample ? sampleProject() : emptyProject(t("file.untitled")), null);
      if (sample) setDirty(true); // never saved yet
    },
    openFile: async (p) => {
      load(fromWire(await openProject(p)), p);
      addRecent(p);
      setRecents(getRecents());
    },
    saveTo: async (p) => {
      const current = snapshot("save");
      if (!current) throw new Error("No project is open.");
      const written = await saveProject(p, toWire(current));
      setPath(written);
      setDirty(false);
      addRecent(written);
      setRecents(getRecents());
      return written;
    },
  };
  const agentApi = useMemo<AgentApi>(
    () => ({
      project: () => projectRef.current,
      path: () => live.current.path,
      docName: () => live.current.docName,
      dirty: () => live.current.dirty,
      rev: () => revRef.current,
      render: () => live.current.render,
      layout: () => live.current.layout,
      layoutPending: () => layoutPending.current,
      printView: () => live.current.printView,
      setPrintView,
      viewer: () => viewerRef.current,
      replace: (next) => {
        commit(next);
        setDirty(true);
      },
      edit: (fn) => {
        // the state before the agent's change goes into the history (once per burst of changes)
        snapshot("agent");
        edit(fn);
      },
      save: () => saveRef.current(),
      newProject: (sample) => actions.current.newProject(sample),
      openFile: (p) => actions.current.openFile(p),
      saveTo: (p) => actions.current.saveTo(p),
    }),
    [edit, snapshot, commit],
  );
  useAgentBridge(agentApi);

  const open = !!project;
  const menus: Menu[] = useMemo(
    () => [
      {
        id: "file",
        label: t("menu.file"),
        items: [
          { label: t("menu.new"), shortcut: "Ctrl+N", onSelect: newProject },
          { label: t("menu.open"), shortcut: "Ctrl+O", onSelect: openDialog },
          { separator: true, label: "" },
          { label: t("menu.save"), shortcut: "Ctrl+S", onSelect: doSave, disabled: !open },
          { label: t("menu.saveAs"), shortcut: "Ctrl+Shift+S", onSelect: doSaveAs, disabled: !open },
          { separator: true, label: "" },
          { label: t("menu.history"), shortcut: "Ctrl+H", onSelect: () => setDialog("history"), disabled: !open },
          { label: t("menu.export"), shortcut: "Ctrl+E", onSelect: () => setDialog("export"), disabled: !open },
          { separator: true, label: "" },
          { label: t("menu.close"), shortcut: "Ctrl+W", onSelect: closeProject, disabled: !open },
        ],
      },
      {
        id: "settings",
        label: t("menu.settingsShort"),
        items: [
          { label: t("menu.project"), onSelect: () => setDialog("settings"), disabled: !open },
          { label: t("menu.preferences"), shortcut: "Ctrl+,", onSelect: () => setDialog("prefs") },
        ],
      },
      {
        id: "help",
        label: t("menu.help"),
        items: [
          { label: t("menu.kb"), onSelect: () => setDialog("kb") },
          { separator: true, label: "" },
          updateReady
            ? { label: t("restartToUpdate", { version: updateReady }), onSelect: restartToUpdate }
            : { label: t("checkUpdates"), onSelect: () => checkForUpdates() },
          { separator: true, label: "" },
          { label: t("menu.about"), onSelect: () => setDialog("about") },
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, open, dirty, path, project, updateReady],
  );

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (k === "n") run(newProject);
      else if (k === "o") run(openDialog);
      else if (k === "s" && open) run(() => void (e.shiftKey ? doSaveAs() : doSave()));
      else if (k === "e" && open) run(() => setDialog("export"));
      else if (k === "h" && open) run(() => setDialog("history"));
      else if (k === "w" && open) run(closeProject);
      else if (k === ",") run(() => setDialog("prefs"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // splitter drag (desktop)
  const startDrag = (side: "source" | "preview") => (e: React.PointerEvent) => {
    const startX = e.clientX;
    const start = cols[side];
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const next = Math.max(220, Math.min(1600, start + (side === "source" ? dx : -dx)));
      setCols((c) => ({ ...c, [side]: next }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const patchSettings = (s: ProjectSettings) => edit((p) => ({ ...p, settings: s }));
  /** A click in support-edit mode: add a manual support on the model, or remove the one clicked. */
  const pickSupport = (kind: "model" | "support", pt: [number, number, number]) => {
    if (!project || !layout) return;
    const tiltDeg = project.settings.printing.tilt;
    const [s, c] = [Math.sin((tiltDeg * Math.PI) / 180), Math.cos((tiltDeg * Math.PI) / 180)];
    if (kind === "model") {
      const z0 = pt[2] - layout.zoff;
      const sup = { id: project.supports.nextId, x: pt[0], y: pt[1] * c + z0 * s, z: -pt[1] * s + z0 * c, source: "manual" as const };
      edit((p) => ({ ...p, supports: { list: [...p.supports.list, sup], nextId: sup.id + 1 } }));
      return;
    }
    // nearest support by its position in the plate plane
    let best: { id: number; d: number } | null = null;
    for (const sp of project.supports.list) {
      const y = sp.y * c - sp.z * s;
      const d = Math.hypot(sp.x - pt[0], y - pt[1]);
      if (!best || d < best.d) best = { id: sp.id, d };
    }
    if (best && best.d < 2) {
      const id = best.id;
      edit((p) => ({ ...p, supports: { ...p.supports, list: p.supports.list.filter((x) => x.id !== id) } }));
    }
  };
  /** A click in sprue-move mode: put the sprue where the piece was clicked (print -> model coordinates). */
  const pickSprue = (pt: [number, number, number]) => {
    if (!project || !layout) return;
    const pr = project.settings.printing;
    const tiltDeg = pr.supports.enabled ? pr.tilt : 0;
    const [s, c] = [Math.sin((tiltDeg * Math.PI) / 180), Math.cos((tiltDeg * Math.PI) / 180)];
    const z0 = pt[2] - layout.zoff;
    const at: [number, number, number] = [pt[0], pt[1] * c + z0 * s, -pt[1] * s + z0 * c];
    edit((p) => ({ ...p, settings: { ...p.settings, printing: { ...p.settings.printing, sprueAt: at } } }));
  };
  const patchSupports = (supports: SupportsData) => edit((p) => ({ ...p, supports }));

  const panes = project && {
    source: (
      <SourcePane
        key={`source-${projectId}`}
        source={project.source}
        errorLine={render.status === "error" ? render.error?.line : null}
        highlight={sourceHit}
        onChange={(src) => edit((p) => (p.source === src ? p : { ...p, source: src }))}
      />
    ),
    chat: (
      <ChatPane
        conversations={chat.book.list}
        activeId={chat.book.active}
        messages={chat.log.messages}
        live={chat.live}
        working={chat.working}
        error={chat.error}
        agent={engine?.label ?? null}
        engines={engines ?? []}
        engineId={engine?.id ?? ""}
        context={chat.log.context}
        limits={chat.limits}
        onEngine={setChatEngine}
        unavailable={noAgent}
        models={models}
        model={override.model ?? ""}
        modelDefault={models.find((m) => m.id === pref.model)?.label ?? ""}
        effortDefault={settle(override.model ?? pref.model, pref.effort).effort}
        efforts={active.efforts}
        effort={override.effort ?? ""}
        onModel={(model) => setOverride({ model: model || undefined, effort: undefined })}
        onEffort={(effort) => setOverride({ effort: effort || undefined })}
        canCompact={!!chat.log.session && chat.log.session.engine === engine?.id}
        autoCompact={chat.log.autoCompact === true}
        onAutoCompact={chat.setAutoCompact}
        pdf={engine?.id === "claude"}
        files={draftFiles}
        setFiles={setDraftFiles}
        onSend={chat.send}
        onStop={chat.stop}
        onCompact={chat.compact}
        onSelect={chat.select}
        onNew={chat.create}
        onDelete={chat.remove}
      />
    ),
    preview: (
      <PreviewPane
        key={`preview-${projectId}`}
        project={project}
        render={render}
        layout={layout}
        printView={printView}
        onTogglePrintView={() => setPrintView((v) => !v)}
        onPickSupport={pickSupport}
        onPickSprue={pickSprue}
        onStats={(s) => setTriangles(s ? s.tris : null)}
        onViewer={(v) => (viewerRef.current = v)}
        onLocate={(h) => setSourceHit(h ? { from: h.from, to: h.to } : null)}
        onAnnotated={
          chatEnabled
            ? (picture) => {
                setDraftFiles((cur) => [...cur, picture]);
                setMobilePane("chat");
                notify(t("annotate.attached"));
              }
            : undefined
        }
        onPatchRender={(r) => edit((p) => ({ ...p, settings: { ...p.settings, render: { ...p.settings.render, ...r } } }))}
      />
    ),
  };

  return (
    <Box h="100%" style={{ display: "flex", flexDirection: "column" }}>
      {onboarding && (
        <Onboarding
          chatAvailable={engines === null ? null : !!engine}
          onRefresh={() => void refreshEngines()}
          onDone={(mode, allTools) => {
            setChatEnabled(mode === "chat");
            setPref("chatAllTools", allTools);
            setPref("onboarded", true);
            setOnboarding(false);
          }}
        />
      )}
      <MenuBar menus={menus} title={title} dirty={dirty} trailing={<McpIndicator onClick={() => setDialog("prefs")} />} />

      {!project ? (
        <Welcome recents={recents} onNew={newProject} onOpen={openDialog} onOpenRecent={openRecent} onSample={newSample} />
      ) : compact ? (
        <>
          <Box style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>{panes![mobilePane]}</Box>
          <Group component="nav" gap={0} wrap="nowrap" bg="var(--surface)" bd="0 solid var(--border)" aria-label={t("app.panes")} style={{ flex: "none", borderTopWidth: 1, paddingBottom: "env(safe-area-inset-bottom)" }}>
            {((chatEnabled ? ["source", "chat", "preview"] : ["source", "preview"]) as PaneId[]).map((id) => (
              <UnstyledButton key={id} flex={1} py={8} px={2} fz={11} c={mobilePane === id ? "var(--accent)" : "dimmed"} onClick={() => setMobilePane(id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <Icon name={id === "source" ? "code" : id === "chat" ? "chat" : "cube"} size={20} />
                {t(`${id}.title`)}
              </UnstyledButton>
            ))}
            <UnstyledButton flex={1} py={8} px={2} fz={11} c="dimmed" onClick={() => setDialog("settings")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <Icon name="gear" size={20} />
              {t("menu.settingsShort")}
            </UnstyledButton>
          </Group>
        </>
      ) : (
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: chatEnabled
              ? `${cols.source}px 6px minmax(260px, 1fr) 6px ${cols.preview}px`
              : `${cols.source}px 6px minmax(260px, 1fr)`,
          }}
        >
          {panes!.source}
          <Handle onPointerDown={startDrag("source")} />
          {chatEnabled && (
            <>
              {panes!.chat}
              <Handle onPointerDown={startDrag("preview")} />
            </>
          )}
          {panes!.preview}
        </Box>
      )}

      {dialog === "settings" && project && (
        <SettingsDialog project={project} layout={layout} onChange={patchSettings} onSupports={patchSupports} onClose={() => setDialog(null)} />
      )}
      {dialog === "export" && project && (
        <ExportDialog project={project} name={docName} triangles={triangles} layout={layout} onClose={() => setDialog(null)} onExport={doExport} />
      )}
      {dialog === "history" && project && (
        <HistoryDialog
          project={project}
          onClose={() => setDialog(null)}
          onSnapshot={(label) => {
            snapshot("manual", label);
            setDirty(true);
            notify(t("history.taken"));
          }}
          onRestore={(id) => {
            const p = projectRef.current;
            const next = p && restoreSnapshot(p, id);
            if (!next) return;
            commit(next);
            setDirty(true);
            notify(t("history.restored", { name: p.history.find((x) => x.id === id)?.label || t("history.title") }));
          }}
          onDelete={(id) => edit((p) => removeSnapshot(p, id))}
          onRename={(id, label) => edit((p) => renameSnapshot(p, id, label))}
        />
      )}
      {dialog === "kb" && (
        <KbDialog
          onClose={() => setDialog(null)}
          onLoad={
            project
              ? (code) => {
                  edit((p) => (p.source === code ? p : { ...p, source: code }));
                  setDialog(null);
                  notify(t("kb.loaded"));
                }
              : null
          }
        />
      )}
      {dialog === "about" && <AboutDialog onClose={() => setDialog(null)} />}
      {dialog === "prefs" && <PreferencesDialog
          autoUpdate={autoUpdate}
          autoUpdateAvailable={selfUpdate}
          onAutoUpdate={setAutoUpdate}
          chatEnabled={chatEnabled}
          onChatEnabled={setChatEnabled}
          engines={engines}
          engine={engine?.id ?? null}
          onEngine={setChatEngine}
          models={models}
          model={pref.model}
          efforts={pref.efforts}
          effort={pref.effort}
          onModel={(model) => setDefault({ model, effort: undefined })}
          onEffort={(effort) => setDefault({ effort })}
          onRefreshEngines={refreshEngines}
          onClose={() => setDialog(null)}
        />}
      {pending && (
        <ConfirmDialog
          name={title}
          onCancel={() => setPending(null)}
          onDiscard={() => {
            const { next } = pending;
            setPending(null);
            next();
          }}
          onSave={async () => {
            const { next } = pending;
            if (await doSave()) {
              setPending(null);
              next();
            }
          }}
        />
      )}

      <Affix position={{ bottom: compact ? 78 : 74, left: 0, right: 0 }} zIndex={500} style={{ display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        {toast && (
          <Paper role="status" px={16} py={8} bg="var(--text)" c="var(--bg)" shadow="md" maw="calc(100% - 32px)" style={{ borderRadius: 999, pointerEvents: "auto" }}>
            <Text inherit>{toast}</Text>
          </Paper>
        )}
      </Affix>
    </Box>
  );
}

export default App;
