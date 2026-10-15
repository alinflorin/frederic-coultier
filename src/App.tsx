import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { emptyProject, sampleProject } from "./mock";
import type { FcProject, ProjectSettings } from "./types";
import { MenuBar, type Menu } from "./components/MenuBar";
import { SourcePane } from "./components/SourcePane";
import { ChatPane } from "./components/ChatPane";
import { PreviewPane } from "./components/PreviewPane";
import { SettingsDialog } from "./components/SettingsDialog";
import { ExportDialog } from "./components/ExportDialog";
import { Welcome } from "./components/Welcome";
import { Icon } from "./components/Icon";
import "./App.css";

type PaneId = "source" | "chat" | "preview";
type DialogId = "settings" | "export" | "saveAs" | null;

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

function App() {
  const { t } = useTranslation();
  const compact = useMediaQuery("(max-width: 899px)");

  // File state. `project` is the in-memory content of the open .fc file.
  const [project, setProject] = useState<FcProject | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [dialog, setDialog] = useState<DialogId>(null);
  const [saveAsName, setSaveAsName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mobilePane, setMobilePane] = useState<PaneId>("chat");
  const [cols, setCols] = useState({ source: 340, preview: 460 });

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const edit = useCallback((fn: (p: FcProject) => FcProject) => {
    setProject((p) => (p ? fn(p) : p));
    setDirty(true);
  }, []);

  // --- file actions (UI only: no disk I/O yet) ---
  const newProject = () => {
    setProject(emptyProject(t("file.untitled")));
    setFileName(null);
    setDirty(false);
  };
  const openProject = () => {
    // TODO: native file dialog + .fc reader
    setProject(sampleProject());
    setFileName("Solitaire ring.fc");
    setDirty(false);
  };
  const closeProject = () => {
    if (dirty && !window.confirm(t("file.discard"))) return;
    setProject(null);
    setFileName(null);
    setDirty(false);
    setDialog(null);
  };
  const save = () => {
    if (!project) return;
    if (!fileName) return openSaveAs();
    setDirty(false);
    notify(t("file.saved", { name: fileName }));
  };
  const openSaveAs = () => {
    if (!project) return;
    setSaveAsName((fileName ?? `${project.settings.general.name}.fc`).replace(/\.fc$/, ""));
    setDialog("saveAs");
  };
  const confirmSaveAs = () => {
    const name = `${saveAsName.trim() || t("file.untitled")}.fc`;
    setFileName(name);
    setDirty(false);
    setDialog(null);
    notify(t("file.saved", { name }));
  };

  async function checkForUpdates() {
    try {
      const update = await check();
      if (!update) return notify(t("upToDate"));
      notify(t("downloading", { version: update.version }));
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      notify(String(e));
    }
  }

  // --- chat (mocked reply) ---
  const sendChat = (text: string) => {
    edit((p) => ({ ...p, chat: [...p.chat, { id: crypto.randomUUID(), role: "user", text }] }));
    setBusy(true);
    setTimeout(() => {
      edit((p) => ({
        ...p,
        chat: [
          ...p.chat,
          { id: crypto.randomUUID(), role: "assistant", text: t("chat.mockReply"), change: { added: 6, removed: 2 } },
        ],
      }));
      setBusy(false);
    }, 1400);
  };

  const open = !!project;
  const menus: Menu[] = useMemo(
    () => [
      {
        id: "file",
        label: t("menu.file"),
        items: [
          { label: t("menu.new"), shortcut: "Ctrl+N", onSelect: newProject },
          { label: t("menu.open"), shortcut: "Ctrl+O", onSelect: openProject },
          { separator: true, label: "" },
          { label: t("menu.save"), shortcut: "Ctrl+S", onSelect: save, disabled: !open },
          { label: t("menu.saveAs"), shortcut: "Ctrl+Shift+S", onSelect: openSaveAs, disabled: !open },
          { separator: true, label: "" },
          { label: t("menu.export"), shortcut: "Ctrl+E", onSelect: () => setDialog("export"), disabled: !open },
          { separator: true, label: "" },
          { label: t("menu.close"), shortcut: "Ctrl+W", onSelect: closeProject, disabled: !open },
        ],
      },
      {
        id: "project",
        label: t("menu.project"),
        items: [{ label: t("menu.settings"), shortcut: "Ctrl+,", onSelect: () => setDialog("settings"), disabled: !open }],
      },
      {
        id: "help",
        label: t("menu.help"),
        items: [{ label: t("checkUpdates"), onSelect: checkForUpdates }],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, open, dirty, fileName, project],
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
      else if (k === "o") run(openProject);
      else if (k === "s") run(e.shiftKey ? openSaveAs : save);
      else if (k === "e" && open) run(() => setDialog("export"));
      else if (k === "w" && open) run(closeProject);
      else if (k === ",") open && run(() => setDialog("settings"));
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

  const title = project ? (fileName ?? t("file.untitled")) : "";
  const patchSettings = (s: ProjectSettings) => edit((p) => ({ ...p, settings: s }));

  const panes = project && {
    source: <SourcePane source={project.source} />,
    chat: <ChatPane messages={project.chat} busy={busy} onSend={sendChat} />,
    preview: (
      <PreviewPane
        project={project}
        onPatchRender={(r) => edit((p) => ({ ...p, settings: { ...p.settings, render: { ...p.settings.render, ...r } } }))}
      />
    ),
  };

  return (
    <div className="app">
      <MenuBar menus={menus} title={title} dirty={dirty} />

      {!project ? (
        <Welcome onNew={newProject} onOpen={openProject} onSample={openProject} />
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
        <ExportDialog
          project={project}
          onClose={() => setDialog(null)}
          onExport={(f) => {
            setDialog(null);
            notify(t("export.done", { file: f }));
          }}
        />
      )}
      {dialog === "saveAs" && (
        <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && setDialog(null)}>
          <form
            className="dialog"
            onSubmit={(e) => {
              e.preventDefault();
              confirmSaveAs();
            }}
          >
            <header className="dialog-head"><h2>{t("menu.saveAs")}</h2></header>
            <div className="dialog-body">
              <label className="field">
                <span className="field-label">{t("file.name")}</span>
                <span className="field-input">
                  <input autoFocus value={saveAsName} onChange={(e) => setSaveAsName(e.currentTarget.value)} />
                  <span className="muted">.fc</span>
                </span>
              </label>
            </div>
            <footer className="dialog-foot">
              <span className="grow" />
              <button type="button" onClick={() => setDialog(null)}>{t("common.cancel")}</button>
              <button type="submit" className="primary">{t("menu.save")}</button>
            </footer>
          </form>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default App;
