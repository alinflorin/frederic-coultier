import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EXPORT_FORMATS, type PrintLayout } from "../api";
import { EXPORT_PRESETS, presetById } from "../exportPresets";
import { getPref, setPref } from "../prefs";
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
  name,
  triangles,
  layout,
  onExport,
  onClose,
}: {
  project: FcProject;
  name: string;
  triangles: number | null;
  /** The print layout, when there is one, for the "fits the plate" check. */
  layout: PrintLayout | null;
  onExport: (format: ExportFormat, pick: ExportPick) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const canSupports = project.settings.printing.supports.enabled && project.supports.list.length > 0;
  const [presetId, setPresetId] = useState<string>(() => getPref<string>("exportPreset") ?? EXPORT_PRESETS[0].id);
  const preset = presetById(presetId);
  const custom = (): ExportPick => ({
    supports: canSupports,
    simplify: project.settings.optimization.simplify,
    sprue: project.settings.printing.sprue,
    hollow: project.settings.printing.hollow.enabled,
  });
  const [format, setFormat] = useState<ExportFormat>(preset?.format ?? "stl-bin");
  const [pick, setPick] = useState<ExportPick>(() => (preset ? preset.pick(project, canSupports) : custom()));
  const choosePreset = (id: string) => {
    setPresetId(id);
    setPref("exportPreset", id);
    const next = presetById(id);
    setFormat(next?.format ?? "stl-bin");
    setPick(next ? next.pick(project, canSupports) : custom());
  };
  // what to check before sending to the printer
  const pr = project.settings.printing;
  const checks: { ok: boolean | null; key: string; values?: Record<string, unknown> }[] = preset
    ? [
        { ok: layout ? layout.fits : null, key: "fits", values: { bed: preset.bed?.join(" × ") } },
        { ok: canSupports, key: "supports", values: { n: project.supports.list.length } },
        ...(pr.supports.enabled && pr.tilt > 0 ? [{ ok: true, key: "tilt", values: { tilt: pr.tilt } }] : []),
        ...(project.settings.material.process === "casting" ? [{ ok: pick.sprue, key: "sprue" }] : []),
      ]
    : [];
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
            {triangles ? `${name}.${f.ext} · ${triangles.toLocaleString()} ${t("preview.tris")} · ${size}` : t("export.noModel")}
          </span>
          <button onClick={onClose}>{t("common.cancel")}</button>
          <button className="primary" disabled={!triangles} onClick={() => onExport(format, { ...pick, supports: canSupports && pick.supports })}>
            {t("export.action")}
          </button>
        </>
      }
    >
      <h3>{t("export.presetTitle")}</h3>
      <div className="format-grid" role="radiogroup" aria-label={t("export.presetTitle")}>
        {EXPORT_PRESETS.map((x) => (
          <button key={x.id} role="radio" aria-checked={presetId === x.id} className={`format${presetId === x.id ? " on" : ""}`} onClick={() => choosePreset(x.id)}>
            <b>{t(`export.preset.${x.id}.name`)}</b>
            <span className="muted">{t(`export.preset.${x.id}.about`)}</span>
          </button>
        ))}
        <button role="radio" aria-checked={!preset} className={`format${!preset ? " on" : ""}`} onClick={() => choosePreset("custom")}>
          <b>{t("export.preset.custom.name")}</b>
          <span className="muted">{t("export.preset.custom.about")}</span>
        </button>
      </div>
      {preset && (
        <>
          <ul className="preflight" aria-label={t("export.preflight")}>
            {checks.map((c) => (
              <li key={c.key} className={c.ok === null ? "unknown" : c.ok ? "ok" : "warn"}>
                {c.ok === null ? "•" : c.ok ? "✓" : "!"} {t(`export.preset.${preset.id}.check.${c.key}.${c.ok === null ? "unknown" : c.ok ? "ok" : "warn"}`, c.values)}
              </li>
            ))}
          </ul>
          <ul className="preset-hints muted">
            {preset.hints.map((h) => (
              <li key={h}>{t(`export.preset.${preset.id}.hint.${h}`)}</li>
            ))}
          </ul>
        </>
      )}

      <h3>{t("export.format")}</h3>
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
