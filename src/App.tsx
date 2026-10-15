import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  RenderError,
  exportModel,
  inTauri,
  openProject,
  pickExportPath,
  pickProjectToOpen,
  pickProjectToSave,
  renderScad,
  saveProject,
} from "./api";
import { emptyProject, sampleProject } from "./defaults";
import { addRecent, baseName, fromWire, getRecents, removeRecent, toWire } from "./project";
import type { ExportFormat, FcProject, ProjectSettings } from "./types";
import { MenuBar, type Menu } from "./components/MenuBar";
import { SourcePane } from "./components/SourcePane";
import { ChatPane } from "./components/ChatPane";
import { PreviewPane, type RenderState } from "./components/PreviewPane";
import { SettingsDialog } from "./components/SettingsDialog";
import { ExportDialog } from "./components/ExportDialog";
import { PreferencesDialog } from "./components/PreferencesDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Welcome } from "./components/Welcome";
import { Icon } from "./components/Icon";
import "./App.css";

type PaneId = "source" | "chat" | "preview";
type DialogId = "settings" | "export" | "prefs" | null;

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
  const [busy, setBusy] = useState(false);
  const [mobilePane, setMobilePane] = useState<PaneId>("chat");
  const [cols, setCols] = useState({ source: 340, preview: 460 });
  const [render, setRender] = useState<RenderState>(IDLE);
  const [triangles, setTriangles] = useState<number | null>(null);
  const [recents, setRecents] = useState(getRecents);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const edit = useCallback((fn: (p: FcProject) => FcProject) => {
    setProject((p) => (p ? fn(p) : p));
    setDirty(true);
  }, []);

  const load = (p: FcProject, filePath: string | null) => {
    setProject(p);
    setPath(filePath);
    setDirty(false);
    setRender(IDLE);
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
        setRender({ status: "ok", mesh: res.stl, ms: res.ms, diagnostics: res.diagnostics, echoes: res.echoes });
      } catch (e) {
        if (id !== request.current) return;
        // keep showing the last good model while the source is broken
        setRender((r) => ({
          ...r,
          status: "error",
          error: e instanceof RenderError ? e : new RenderError(errorText(e)),
        }));
      }
    }, RENDER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [source, projectId]);

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
      const target = await pickProjectToSave(path ? baseName(path).replace(/\.fc$/i, "") : project.settings.general.name);
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
      setProject(null);
      setPath(null);
      setDirty(false);
      setDialog(null);
      setRender(IDLE);
      setTriangles(null);
    });

  const doExport = async (format: ExportFormat) => {
    if (!project) return;
    setDialog(null);
    try {
      const target = await pickExportPath(path ? baseName(path).replace(/\.fc$/i, "") : project.settings.general.name, format);
      if (!target) return;
      await exportModel(project.source, target, format);
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

  // --- chat (still a canned reply: the AI backend comes later) ---
  const sendChat = (text: string) => {
    edit((p) => ({ ...p, chat: [...p.chat, { id: crypto.randomUUID(), role: "user", text }] }));
    setBusy(true);
    setTimeout(() => {
      edit((p) => ({
        ...p,
        chat: [...p.chat, { id: crypto.randomUUID(), role: "assistant", text: t("chat.mockReply") }],
      }));
      setBusy(false);
    }, 1400);
  };

  // --- window title, and asking before the window closes with unsaved work ---
  const title = project ? (path ? baseName(path) : t("file.untitled")) : "";
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
        items: [{ label: t("menu.settings"), onSelect: () => setDialog("settings"), disabled: !open }],
      },
      { id: "prefs", label: t("menu.preferences"), onSelect: () => setDialog("prefs") },
      {
        id: "help",
        label: t("menu.help"),
        items: [{ label: t("checkUpdates"), onSelect: checkForUpdates }],
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
      const next = Math.max(220, Math.min(720, start + (side === "source" ? dx : -dx)));
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

  const panes = project && {
    source: (
      <SourcePane
        key={projectId}
        source={project.source}
        errorLine={render.status === "error" ? render.error?.line : null}
        onChange={(src) => edit((p) => (p.source === src ? p : { ...p, source: src }))}
      />
    ),
    chat: <ChatPane messages={project.chat} busy={busy} onSend={sendChat} />,
    preview: (
      <PreviewPane
        key={projectId}
        project={project}
        render={render}
        onStats={(s) => setTriangles(s ? s.tris : null)}
        onPatchRender={(r) => edit((p) => ({ ...p, settings: { ...p.settings, render: { ...p.settings.render, ...r } } }))}
      />
    ),
  };

  return (
    <div className="app">
      <MenuBar menus={menus} title={title} dirty={dirty} />

      {!project ? (
        <Welcome recents={recents} onNew={newProject} onOpen={openDialog} onOpenRecent={openRecent} onSample={newSample} />
      ) : compact ? (
        <>
          <div className="single">{panes![mobilePane]}</div>
          <nav className="tabbar" aria-label={t("app.panes")}>
            {(["source", "chat", "preview"] as PaneId[]).map((id) => (
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
          style={{ gridTemplateColumns: `${cols.source}px 6px minmax(300px, 1fr) 6px ${cols.preview}px` }}
        >
          {panes!.source}
          <div className="splitter" onPointerDown={startDrag("source")} role="separator" aria-orientation="vertical" />
          {panes!.chat}
          <div className="splitter" onPointerDown={startDrag("preview")} role="separator" aria-orientation="vertical" />
          {panes!.preview}
        </div>
      )}

      {dialog === "settings" && project && (
        <SettingsDialog project={project} onChange={patchSettings} onClose={() => setDialog(null)} />
      )}
      {dialog === "export" && project && (
        <ExportDialog project={project} triangles={triangles} onClose={() => setDialog(null)} onExport={doExport} />
      )}
      {dialog === "prefs" && <PreferencesDialog onClose={() => setDialog(null)} />}
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
