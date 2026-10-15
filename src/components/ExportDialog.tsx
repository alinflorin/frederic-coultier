import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExportFormat, FcProject } from "../types";
import { Dialog } from "./Dialog";

const FORMATS: { id: ExportFormat; ext: string }[] = [
  { id: "stl-bin", ext: "stl" },
  { id: "stl-ascii", ext: "stl" },
  { id: "obj", ext: "obj" },
  { id: "3mf", ext: "3mf" },
];

export function ExportDialog({
  project,
  onExport,
  onClose,
}: {
  project: FcProject;
  onExport: (file: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const s = project.settings;
  const hasSupports = project.supportCount.auto + project.supportCount.manual > 0;
  const [format, setFormat] = useState<ExportFormat>("stl-bin");
  const [supports, setSupports] = useState(hasSupports && s.printing.supports.enabled);
  const [simplify, setSimplify] = useState(s.optimization.simplify);
  const [hollow, setHollow] = useState(s.printing.hollow.enabled);
  const [sprue, setSprue] = useState(s.printing.sprue);

  const ext = FORMATS.find((f) => f.id === format)!.ext;
  const file = `${s.general.name.replace(/\s+/g, "-").toLowerCase()}.${ext}`;
  const tris = Math.round(48212 * (simplify ? s.optimization.keepPercent / 100 : 1));
  const bytes = format === "stl-bin" ? tris * 50 : format === "stl-ascii" ? tris * 250 : format === "obj" ? tris * 90 : tris * 40;
  const size = bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} kB`;

  return (
    <Dialog
      title={t("export.title")}
      onClose={onClose}
      footer={
        <>
          <span className="muted grow">{file} · {tris.toLocaleString()} {t("preview.tris")} · ~{size}</span>
          <button onClick={onClose}>{t("common.cancel")}</button>
          <button className="primary" onClick={() => onExport(file)}>{t("export.action")}</button>
        </>
      }
    >
      <div className="format-grid" role="radiogroup" aria-label={t("export.format")}>
        {FORMATS.map((f) => (
          <button key={f.id} role="radio" aria-checked={format === f.id} className={`format${format === f.id ? " on" : ""}`} onClick={() => setFormat(f.id)}>
            <b>{t(`export.fmt.${f.id}`)}</b>
            <span className="muted">{t(`export.fmtHint.${f.id}`)}</span>
          </button>
        ))}
      </div>

      <h3>{t("export.options")}</h3>
      <label className="check">
        <input type="checkbox" checked={supports} disabled={!hasSupports} onChange={(e) => setSupports(e.currentTarget.checked)} />
        {t("export.supports")} <span className="muted">{hasSupports ? t("export.tilted") : t("export.noSupports")}</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={simplify} onChange={(e) => setSimplify(e.currentTarget.checked)} />
        {t("export.simplify", { pct: s.optimization.keepPercent })}
      </label>
      <label className="check">
        <input type="checkbox" checked={hollow} onChange={(e) => setHollow(e.currentTarget.checked)} />
        {t("export.hollow", { wall: s.printing.hollow.wall })}
      </label>
      <label className="check">
        <input type="checkbox" checked={sprue} onChange={(e) => setSprue(e.currentTarget.checked)} />
        {t("export.sprue")}
      </label>
      {simplify && <p className="muted note">{t("export.safety", { max: s.optimization.maxVolumeChange })}</p>}
    </Dialog>
  );
}
