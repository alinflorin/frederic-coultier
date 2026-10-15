import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { FcProject, Finish, Metal, ProjectSettings } from "../types";
import { Dialog } from "./Dialog";

type Tab = "general" | "material" | "printing" | "optimization";
const TABS: Tab[] = ["general", "material", "printing", "optimization"];
const METALS: Metal[] = ["silver925", "gold18y", "gold18r", "gold18w", "platinum", "resin"];
const FINISHES: Finish[] = ["polished", "satin", "matte"];

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input">{children}</span>
      {hint && <span className="field-hint muted">{hint}</span>}
    </label>
  );
}

function Num({
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <span className="num">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      {unit && <span className="muted">{unit}</span>}
    </span>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      {label}
    </label>
  );
}

export function SettingsDialog({
  project,
  onChange,
  onClose,
}: {
  project: FcProject;
  onChange: (s: ProjectSettings) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("general");
  const s = project.settings;
  const sup = s.printing.supports;
  const supTotal = project.supportCount.auto + project.supportCount.manual;

  const setP = (p: Partial<ProjectSettings["printing"]>) => onChange({ ...s, printing: { ...s.printing, ...p } });
  const setSup = (p: Partial<typeof sup>) => setP({ supports: { ...sup, ...p } });

  return (
    <Dialog
      wide
      title={t("settings.title")}
      onClose={onClose}
      footer={
        <>
          <span className="muted grow">{t("settings.autosave")}</span>
          <button className="primary" onClick={onClose}>{t("common.done")}</button>
        </>
      }
    >
      <div className="settings">
        <div className="tabs" role="tablist">
          {TABS.map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {t(`settings.tab.${k}`)}
            </button>
          ))}
        </div>

        <div className="tab-body" role="tabpanel">
          {tab === "general" && (
            <>
              <Field label={t("settings.name")}>
                <input value={s.general.name} onChange={(e) => onChange({ ...s, general: { ...s.general, name: e.currentTarget.value } })} />
              </Field>
              <Field label={t("settings.notes")}>
                <textarea rows={4} value={s.general.notes} onChange={(e) => onChange({ ...s, general: { ...s.general, notes: e.currentTarget.value } })} />
              </Field>
            </>
          )}

          {tab === "material" && (
            <>
              <h3>{t("settings.materialTitle")}</h3>
              <Field label={t("settings.metal")} hint={t("settings.metalHint")}>
                <select value={s.material.metal} onChange={(e) => onChange({ ...s, material: { ...s.material, metal: e.currentTarget.value as Metal } })}>
                  {METALS.map((m) => <option key={m} value={m}>{t(`metal.${m}`)}</option>)}
                </select>
              </Field>
              <Field label={t("settings.process")}>
                <select value={s.material.process} onChange={(e) => onChange({ ...s, material: { ...s.material, process: e.currentTarget.value as "direct" | "casting" } })}>
                  <option value="casting">{t("settings.casting")}</option>
                  <option value="direct">{t("settings.direct")}</option>
                </select>
              </Field>
              <h3>{t("settings.renderTitle")}</h3>
              <Field label={t("settings.metalColor")}>
                <input type="color" value={s.render.metalColor} onChange={(e) => onChange({ ...s, render: { ...s.render, metalColor: e.currentTarget.value } })} />
              </Field>
              <Field label={t("settings.finish")}>
                <select value={s.render.finish} onChange={(e) => onChange({ ...s, render: { ...s.render, finish: e.currentTarget.value as Finish } })}>
                  {FINISHES.map((f) => <option key={f} value={f}>{t(`finish.${f}`)}</option>)}
                </select>
              </Field>
              <Field label={t("settings.previewQuality")} hint={t("settings.previewQualityHint")}>
                <Num value={s.render.previewQuality} min={12} max={256} step={4} onChange={(v) => onChange({ ...s, render: { ...s.render, previewQuality: v } })} unit="$fn" />
              </Field>
            </>
          )}

          {tab === "printing" && (
            <>
              <Field label={t("settings.printer")}>
                <select value={s.printing.printer} onChange={(e) => setP({ printer: e.currentTarget.value })}>
                  <option>Elegoo Mars 5</option>
                </select>
              </Field>
              <Field label={t("settings.minWall")} hint={t("settings.minWallHint")}>
                <Num value={s.printing.minWall} min={0.2} max={3} onChange={(v) => setP({ minWall: v })} unit="mm" />
              </Field>
              <Field label={t("settings.tilt")} hint={t("settings.tiltHint")}>
                <Num value={s.printing.tilt} min={0} max={60} step={5} onChange={(v) => setP({ tilt: v })} unit="°" />
              </Field>

              <h3>{t("settings.supportsTitle")}</h3>
              <Check checked={sup.enabled} onChange={(v) => setSup({ enabled: v })} label={t("settings.supportsEnable")} />
              <fieldset disabled={!sup.enabled}>
                <Field label={t("settings.tipRadius")}>
                  <Num value={sup.tipRadius} min={0.1} max={1} step={0.05} onChange={(v) => setSup({ tipRadius: v })} unit="mm" />
                </Field>
                <Field label={t("settings.baseRadius")}>
                  <Num value={sup.baseRadius} min={0.2} max={2} step={0.1} onChange={(v) => setSup({ baseRadius: v })} unit="mm" />
                </Field>
                <Field label={t("settings.overhang")}>
                  <Num value={sup.overhangAngle} min={0} max={80} step={5} onChange={(v) => setSup({ overhangAngle: v })} unit="°" />
                </Field>
                <Field label={t("settings.spacing")}>
                  <Num value={sup.spacing} min={1} max={10} step={0.5} onChange={(v) => setSup({ spacing: v })} unit="mm" />
                </Field>
                <Field label={t("settings.raft")}>
                  <Num value={sup.raftRadius} min={0} max={10} step={0.5} onChange={(v) => setSup({ raftRadius: v })} unit="mm" />
                </Field>
                <div className="support-actions">
                  <span className="muted grow">
                    {t("settings.supportCount", { count: supTotal, auto: project.supportCount.auto, manual: project.supportCount.manual })}
                  </span>
                  <button>{t("settings.suggestTilt")}</button>
                  <button>{t("settings.autoSupports")}</button>
                  <button>{t("settings.clearSupports")}</button>
                </div>
              </fieldset>

              <h3>{t("settings.hollowTitle")}</h3>
              <Check checked={s.printing.hollow.enabled} onChange={(v) => setP({ hollow: { ...s.printing.hollow, enabled: v } })} label={t("settings.hollowEnable")} />
              <fieldset disabled={!s.printing.hollow.enabled}>
                <Field label={t("settings.hollowWall")}>
                  <Num value={s.printing.hollow.wall} min={0.4} max={3} onChange={(v) => setP({ hollow: { ...s.printing.hollow, wall: v } })} unit="mm" />
                </Field>
                <Field label={t("settings.drain")}>
                  <Num value={s.printing.hollow.drain} min={0.5} max={3} onChange={(v) => setP({ hollow: { ...s.printing.hollow, drain: v } })} unit="mm" />
                </Field>
              </fieldset>
              <Check checked={s.printing.sprue} onChange={(v) => setP({ sprue: v })} label={t("settings.sprue")} />
            </>
          )}

          {tab === "optimization" && (
            <>
              <p className="muted">{t("settings.optimizeIntro")}</p>
              <Check checked={s.optimization.simplify} onChange={(v) => onChange({ ...s, optimization: { ...s.optimization, simplify: v } })} label={t("settings.simplify")} />
              <fieldset disabled={!s.optimization.simplify}>
                <Field label={t("settings.keep")} hint={t("settings.keepHint")}>
                  <span className="num">
                    <input type="range" min={1} max={99} value={s.optimization.keepPercent} onChange={(e) => onChange({ ...s, optimization: { ...s.optimization, keepPercent: Number(e.currentTarget.value) } })} />
                    <b>{s.optimization.keepPercent}%</b>
                  </span>
                </Field>
                <Field label={t("settings.maxVolume")} hint={t("settings.maxVolumeHint")}>
                  <Num value={s.optimization.maxVolumeChange} min={0.1} max={5} onChange={(v) => onChange({ ...s, optimization: { ...s.optimization, maxVolumeChange: v } })} unit="%" />
                </Field>
              </fieldset>
              <div className="stat-row">
                <div><span className="muted">{t("settings.trisNow")}</span><b>48 212</b></div>
                <div><span className="muted">{t("settings.trisAfter")}</span><b>{s.optimization.simplify ? Math.round(48212 * s.optimization.keepPercent / 100).toLocaleString() : "48 212"}</b></div>
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
