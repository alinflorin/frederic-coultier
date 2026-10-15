import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EXPORT_FORMATS } from "../api";
import type { ExportFormat, FcProject } from "../types";
import { Dialog } from "./Dialog";

export interface ExportPick {
  supports: boolean;
  simplify: boolean;
  sprue: boolean;
  hollow: boolean;
}

export function ExportDialog({
  project,
  triangles,
  onExport,
  onClose,
}: {
  project: FcProject;
  triangles: number | null;
  onExport: (format: ExportFormat, pick: ExportPick) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>("stl-bin");
  const canSupports = project.settings.printing.supports.enabled && project.supports.list.length > 0;
  const [pick, setPick] = useState<ExportPick>({
    supports: canSupports,
    simplify: project.settings.optimization.simplify,
    sprue: project.settings.printing.sprue,
    hollow: project.settings.printing.hollow.enabled,
  });
  const f = EXPORT_FORMATS.find((x) => x.id === format)!;

  // Binary STL is exact (84 + 50 bytes per triangle); the others are rough guides.
  let size = "";
  if (triangles) {
    const bytes = format === "stl-bin" ? 84 + triangles * 50 : format === "stl-ascii" ? triangles * 250 : format === "obj" ? triangles * 45 : triangles * 25;
    size = `~${bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} kB`}`;
  }

  return (
    <Dialog
      title={t("export.title")}
      onClose={onClose}
      footer={
        <>
          <span className="muted grow">
            {triangles ? `${project.settings.general.name}.${f.ext} · ${triangles.toLocaleString()} ${t("preview.tris")} · ${size}` : t("export.noModel")}
          </span>
          <button onClick={onClose}>{t("common.cancel")}</button>
          <button className="primary" disabled={!triangles} onClick={() => onExport(format, { ...pick, supports: canSupports && pick.supports })}>
            {t("export.action")}
          </button>
        </>
      }
    >
      <div className="format-grid" role="radiogroup" aria-label={t("export.format")}>
        {EXPORT_FORMATS.map((x) => (
          <button key={x.id} role="radio" aria-checked={format === x.id} className={`format${format === x.id ? " on" : ""}`} onClick={() => setFormat(x.id)}>
            <b>{t(`export.fmt.${x.id}`)}</b>
            <span className="muted">{t(`export.fmtHint.${x.id}`)}</span>
          </button>
        ))}
      </div>

      <h3>{t("export.options")}</h3>
      <label className="check">
        <input type="checkbox" disabled={!canSupports} checked={canSupports && pick.supports} onChange={(e) => setPick({ ...pick, supports: e.currentTarget.checked })} />
        {t("export.opt.supports")}
        {!canSupports && <span className="muted"> {t("export.noSupports")}</span>}
      </label>
      <label className="check">
        <input type="checkbox" checked={pick.simplify} onChange={(e) => setPick({ ...pick, simplify: e.currentTarget.checked })} />
        {t("export.opt.simplify")} <span className="muted">({project.settings.optimization.keepPercent}%)</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={pick.sprue} onChange={(e) => setPick({ ...pick, sprue: e.currentTarget.checked })} />
        {t("export.opt.sprue")}
      </label>
      <label className="check">
        <input type="checkbox" checked={pick.hollow} onChange={(e) => setPick({ ...pick, hollow: e.currentTarget.checked })} />
        {t("export.opt.hollow")} <span className="muted">({project.settings.printing.hollow.wall} mm)</span>
      </label>
    </Dialog>
  );
}
