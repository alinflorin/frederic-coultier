import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { diffStats, lineDiff, sameDesign } from "../history";
import type { FcProject } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

export function HistoryDialog({
  project,
  onSnapshot,
  onRestore,
  onDelete,
  onRename,
  onClose,
}: {
  project: FcProject;
  onSnapshot: (label: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const list = useMemo(() => [...project.history].reverse(), [project.history]);
  const [selected, setSelected] = useState<string | null>(list[0]?.id ?? null);
  const [label, setLabel] = useState("");
  // window.prompt is not available in the desktop webview, so renaming happens inline
  const [renaming, setRenaming] = useState<string | null>(null);
  const snap = list.find((s) => s.id === selected) ?? null;
  const diff = useMemo(() => (snap ? lineDiff(snap.source, project.source) : []), [snap, project.source]);
  const stats = diffStats(diff);
  const same = snap ? sameDesign(snap, project) : false;
  const when = (ms: number) => new Date(ms).toLocaleString();
  const name = (s: (typeof list)[number]) => s.label || t(`history.kind.${s.kind}`);

  return (
    <Dialog
      title={t("history.title")}
      wide
      onClose={onClose}
      footer={
        <>
          <input
            className="grow"
            value={label}
            placeholder={t("history.namePlaceholder")}
            onChange={(e) => setLabel(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && label.trim()) {
                onSnapshot(label.trim());
                setLabel("");
              }
            }}
          />
          <button
            className="primary"
            onClick={() => {
              onSnapshot(label.trim());
              setLabel("");
            }}
          >
            <Icon name="plus" /> {t("history.take")}
          </button>
        </>
      }
    >
      {list.length === 0 ? (
        <p className="muted">{t("history.empty")}</p>
      ) : (
        <div className="history">
          <ul className="history-list" aria-label={t("history.title")}>
            {list.map((s) => (
              <li key={s.id}>
                <button className={`history-item${s.id === selected ? " on" : ""}`} onClick={() => setSelected(s.id)}>
                  <b>{name(s)}</b>
                  <span className="muted">
                    {when(s.time)} · {t(`history.kind.${s.kind}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {snap && (
            <div className="history-detail">
              <div className="history-actions">
                <button
                  className="primary"
                  disabled={same}
                  onClick={() => {
                    onRestore(snap.id);
                    onClose();
                  }}
                >
                  {t("history.restore")}
                </button>
                <button onClick={() => setRenaming(snap.label)}>{t("history.renameAction")}</button>
                <button onClick={() => onDelete(snap.id)}>{t("history.delete")}</button>
              </div>
              {renaming !== null && (
                <input
                  autoFocus
                  value={renaming}
                  aria-label={t("history.rename")}
                  onChange={(e) => setRenaming(e.currentTarget.value)}
                  onBlur={() => setRenaming(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onRename(snap.id, renaming.trim());
                      setRenaming(null);
                    } else if (e.key === "Escape") {
                      e.stopPropagation();
                      setRenaming(null);
                    }
                  }}
                />
              )}
              <p className="muted">
                {same ? t("history.same") : t("history.changes", { added: stats.added, removed: stats.removed })}
              </p>
              {!same && stats.added + stats.removed > 0 && (
                <pre className="diff" aria-label={t("history.diff")}>
                  {diff.map((l, i) => (
                    <div key={i} className={l.op === "+" ? "add" : l.op === "-" ? "del" : ""}>
                      {l.op} {l.text}
                    </div>
                  ))}
                </pre>
              )}
              {!same && stats.added + stats.removed === 0 && <p className="muted">{t("history.settingsOnly")}</p>}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
