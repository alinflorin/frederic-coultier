import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  RenderError,
  type PrintLayout,
  exportModel,
  inTauri,
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
import { addRecent, baseName, fromWire, getRecents, removeRecent, toWire } from "./project";
import type { ExportFormat, FcProject, ProjectSettings, SupportsData } from "./types";
import { MenuBar, type Menu } from "./components/MenuBar";
import { SourcePane } from "./components/SourcePane";
import { ChatPane } from "./components/ChatPane";
import { PreviewPane, type RenderState } from "./components/PreviewPane";
import { SettingsDialog } from "./components/SettingsDialog";
import { ExportDialog } from "./components/ExportDialog";
import { PreferencesDialog } from "./components/PreferencesDialog";
import { getPref, setPref } from "./prefs";
import { KbDialog } from "./components/KbDialog";
import { McpIndicator } from "./components/McpIndicator";
import { ConfirmDialog } from "./components/ConfirmDialog";
import type { ExportPick } from "./components/ExportDialog";
import { Welcome } from "./components/Welcome";
import { Icon } from "./components/Icon";
import type { Viewer } from "./components/viewer/Viewer";
import { useAgentBridge } from "./agent/useAgentBridge";
import { listEngines, type EngineInfo } from "./chat/engines";
import { useAgentChat } from "./chat/useAgentChat";
import type { AgentApi } from "./agent/ops";
import "./App.css";

type PaneId = "source" | "chat" | "preview";
type DialogId = "settings" | "export" | "prefs" | "kb" | null;

const IDLE: RenderState = { status: "idle", mesh: null, diagnostics: [], echoes: [] };
const RENDER_DELAY_MS = 200;

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e));

function App() {
  const { t } = useTranslation();
  const compact = useMediaQuery("(max-width: 899px)");

  // `project` is the in-memory content of the open .fc file, `path` where it lives on disk.
  const [project, setProject] = useState<FcProject | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Bumped whenever a different project is loaded, so the preview starts with a fresh camera.
  const [projectId, setProjectId] = useState(0);

  const [dialog, setDialog] = useState<DialogId>(null);
  const [pending, setPending] = useState<{ next: () => void } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // The chat pane is opt-in (Preferences > Agent Chat).
  const [chatEnabled, setChatEnabledState] = useState(() => getPref<boolean>("chatEnabled") === true);
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
  const [mobilePane, setMobilePane] = useState<PaneId>("source");
  const [cols, setCols] = useState(() => {
    // chat (middle) stays narrow by default; source and preview share the rest
    const side = Math.max(300, Math.floor((window.innerWidth - 360 - 12) / 2));
    return { source: side, preview: side };
  });
  const [render, setRender] = useState<RenderState>(IDLE);
  const [layout, setLayout] = useState<PrintLayout | null>(null);
  const [printView, setPrintView] = useState(true);
  const [triangles, setTriangles] = useState<number | null>(null);
  const [recents, setRecents] = useState(getRecents);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
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

  const pick = (engine && picks[engine.id]) || {};
  const models = engine?.models ?? [];
  const chosen = models.find((m) => m.id === pick.model);
  const efforts = chosen ? chosen.efforts : (engine?.efforts ?? []);
  const effort = pick.effort && efforts.includes(pick.effort) ? pick.effort : "";
  const setPick = (change: { model?: string; effort?: string }) => {
    if (!engine) return;
    const next = { ...picks, [engine.id]: { ...pick, ...change } };
    setPicks(next);
    setPref("chatPicks", next);
  };
  const chat = useAgentChat({
    projectRef,
    engine: engine?.id ?? null,
    model: chosen?.id ?? "",
    effort,
    path,
    projectId,
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
        setRender({ status: "ok", mesh: res.stl, ms: res.ms, diagnostics: res.diagnostics, echoes: res.echoes, source });
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
    printLayout(source, params, supOpts.enabled ? (supList ?? []) : [], sprueOn ? { diameter: sprueD, length: sprueL, at: sprueAt } : undefined)
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
      const written = await saveProject(target, toWire(project));
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
      await saveProject(path, toWire(project));
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

  async function checkForUpdates() {
    try {
      const update = await check();
      if (!update) return notify(t("upToDate"));
      notify(t("downloading", { version: update.version }));
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      notify(errorText(e));
    }
  }

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
      const current = projectRef.current;
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
      edit,
      save: () => saveRef.current(),
      newProject: (sample) => actions.current.newProject(sample),
      openFile: (p) => actions.current.openFile(p),
      saveTo: (p) => actions.current.saveTo(p),
    }),
    [edit],
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
          { label: t("menu.export"), shortcut: "Ctrl+E", onSelect: () => setDialog("export"), disabled: !open },
          { separator: true, label: "" },
          { label: t("menu.close"), shortcut: "Ctrl+W", onSelect: closeProject, disabled: !open },
        ],
      },
      {
        id: "project",
        label: t("menu.project"),
        onSelect: () => open && setDialog("settings"),
      },
      { id: "prefs", label: t("menu.preferences"), onSelect: () => setDialog("prefs") },
      {
        id: "help",
        label: t("menu.help"),
        items: [
          { label: t("menu.kb"), onSelect: () => setDialog("kb") },
          { separator: true, label: "" },
          { label: t("checkUpdates"), onSelect: checkForUpdates },
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, open, dirty, path, project],
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
        key={projectId}
        source={project.source}
        errorLine={render.status === "error" ? render.error?.line : null}
        onChange={(src) => edit((p) => (p.source === src ? p : { ...p, source: src }))}
      />
    ),
    chat: (
      <ChatPane
        messages={chat.log.messages}
        live={chat.live}
        working={chat.working}
        error={chat.error}
        agent={engine?.label ?? null}
        unavailable={noAgent}
        models={models}
        model={chosen?.id ?? ""}
        efforts={efforts}
        effort={effort}
        onModel={(model) => setPick({ model })}
        onEffort={(effort) => setPick({ effort })}
        canCompact={!!chat.log.session && chat.log.session.engine === engine?.id}
        onSend={chat.send}
        onStop={chat.stop}
        onCompact={chat.compact}
        onClear={chat.clear}
      />
    ),
    preview: (
      <PreviewPane
        key={projectId}
        project={project}
        render={render}
        layout={layout}
        printView={printView}
        onTogglePrintView={() => setPrintView((v) => !v)}
        onPickSupport={pickSupport}
        onPickSprue={pickSprue}
        onStats={(s) => setTriangles(s ? s.tris : null)}
        onViewer={(v) => (viewerRef.current = v)}
        onPatchRender={(r) => edit((p) => ({ ...p, settings: { ...p.settings, render: { ...p.settings.render, ...r } } }))}
      />
    ),
  };

  return (
    <div className="app">
      <MenuBar menus={menus} title={title} dirty={dirty} trailing={<McpIndicator onClick={() => setDialog("prefs")} />} />

      {!project ? (
        <Welcome recents={recents} onNew={newProject} onOpen={openDialog} onOpenRecent={openRecent} onSample={newSample} />
      ) : compact ? (
        <>
          <div className="single">{panes![mobilePane]}</div>
          <nav className="tabbar" aria-label={t("app.panes")}>
            {((chatEnabled ? ["source", "chat", "preview"] : ["source", "preview"]) as PaneId[]).map((id) => (
              <button key={id} className={mobilePane === id ? "on" : ""} onClick={() => setMobilePane(id)}>
                <Icon name={id === "source" ? "code" : id === "chat" ? "chat" : "cube"} size={20} />
                {t(`${id}.title`)}
              </button>
            ))}
            <button onClick={() => setDialog("settings")}>
              <Icon name="gear" size={20} />
              {t("menu.settingsShort")}
            </button>
          </nav>
        </>
      ) : (
        <div
          className="workspace"
          style={{
            gridTemplateColumns: chatEnabled
              ? `${cols.source}px 6px minmax(260px, 1fr) 6px ${cols.preview}px`
              : `${cols.source}px 6px minmax(260px, 1fr)`,
          }}
        >
          {panes!.source}
          <div className="splitter" onPointerDown={startDrag("source")} role="separator" aria-orientation="vertical" />
          {chatEnabled && (
            <>
              {panes!.chat}
              <div className="splitter" onPointerDown={startDrag("preview")} role="separator" aria-orientation="vertical" />
            </>
          )}
          {panes!.preview}
        </div>
      )}

      {dialog === "settings" && project && (
        <SettingsDialog project={project} layout={layout} onChange={patchSettings} onSupports={patchSupports} onClose={() => setDialog(null)} />
      )}
      {dialog === "export" && project && (
        <ExportDialog project={project} name={docName} triangles={triangles} onClose={() => setDialog(null)} onExport={doExport} />
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
      {dialog === "prefs" && <PreferencesDialog
          chatEnabled={chatEnabled}
          onChatEnabled={setChatEnabled}
          engines={engines}
          engine={engine?.id ?? null}
          onEngine={setChatEngine}
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

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default App;
