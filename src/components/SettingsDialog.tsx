import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { FcProject, Finish, Metal, ProjectSettings, Support, SupportsData } from "../types";
import { autoSupports, type PrintLayout, meshReport, printParams, suggestTilt, type MeshReport, type TiltRow } from "../api";
import { DENSITY } from "../materials";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

type Tab = "general" | "material" | "printing" | "optimization" | "checks";
const TABS: Tab[] = ["general", "material", "printing", "optimization", "checks"];
const METALS: Metal[] = ["silver925", "gold18y", "gold18r", "gold18w", "platinum", "resin"];
const FINISHES: Finish[] = ["polished", "satin", "matte"];

/** Findings carry either one value or "a|b|c|d"; the translations use whichever they need. */
function findingParams(detail: string) {
  const [a, b, c, d] = detail.split("|");
  return { detail, n: a, min: b, area: c, limit: d, worst: a, reach: b };
}

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
  layout,
  onChange,
  onSupports,
  onClose,
}: {
  project: FcProject;
  layout: PrintLayout | null;
  onChange: (s: ProjectSettings) => void;
  onSupports: (s: SupportsData) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("general");
  const s = project.settings;
  const sup = s.printing.supports;
  const list = project.supports.list;
  const nAuto = list.filter((x) => x.source === "auto").length;
  const nManual = list.length - nAuto;
  const [working, setWorking] = useState<"tilt" | "auto" | null>(null);
  const [rows, setRows] = useState<TiltRow[] | null>(null);
  const [report, setReport] = useState<MeshReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const analyze = async () => {
    setAnalyzing(true);
    setReportError(null);
    try {
      setReport(
        await meshReport(project.source, s.optimization.simplify ? { keepPercent: s.optimization.keepPercent, maxVolumeChange: s.optimization.maxVolumeChange } : undefined,
          tab === "checks" ? { minWall: s.printing.minWall, minGap: 0.3 } : undefined,
        ),
      );
    } catch (e) {
      setReportError(typeof e === "string" ? e : e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };
  const [note, setNote] = useState<string | null>(null);

  const guard = async (kind: "tilt" | "auto", fn: () => Promise<void>) => {
    setWorking(kind);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setNote(typeof e === "string" ? e : e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(null);
    }
  };
  const runTilt = () =>
    guard("tilt", async () => {
      setRows((await suggestTilt(project.source, sup.overhangAngle, sup.lift)).slice(0, 5));
    });
  const runAuto = () =>
    guard("auto", async () => {
      const manual = list.filter((x) => x.source === "manual");
      const r = await autoSupports(project.source, printParams(s.printing.tilt, sup), sup, manual, project.supports.nextId);
      onSupports({ list: r.supports, nextId: r.nextId });
      setNote(t("settings.autoDone", { added: r.stats.added, blocked: r.stats.blocked }));
    });

  const setSupport = (id: number, p: Partial<Support>) =>
    onSupports({ ...project.supports, list: list.map((x) => (x.id === id ? { ...x, ...p, source: "manual" } : x)) });
  const addSupport = () =>
    onSupports({
      list: [...list, { id: project.supports.nextId, x: 0, y: 0, z: 0, source: "manual" }],
      nextId: project.supports.nextId + 1,
    });
  const removeSupport = (id: number) => onSupports({ ...project.supports, list: list.filter((x) => x.id !== id) });
  const spruePos = s.printing.sprueAt ?? layout?.sprueAt ?? null;
  const setSpruePos = (axis: 0 | 1 | 2, v: number) => {
    const at: [number, number, number] = [...(spruePos ?? [0, 0, 0])];
    at[axis] = v;
    setP({ sprueAt: at });
  };

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
                <Field label={t("settings.raftThickness")} hint={t("settings.raftThicknessHint")}>
                  <Num value={sup.raftThickness} min={0} max={Math.max(0, sup.lift - 0.1)} step={0.1} onChange={(v) => setSup({ raftThickness: v })} unit="mm" />
                </Field>
                <Field label={t("settings.lift")} hint={t("settings.liftHint")}>
                  <Num value={sup.lift} min={1} max={10} step={0.5} onChange={(v) => setSup({ lift: v })} unit="mm" />
                </Field>
                <div className="support-actions">
                  <span className="muted grow">
                    {t("settings.supportCount", { count: list.length, auto: nAuto, manual: nManual })}
                  </span>
                  <button disabled={working !== null} onClick={runTilt}>{working === "tilt" ? "…" : t("settings.suggestTilt")}</button>
                  <button disabled={working !== null} onClick={runAuto}>{working === "auto" ? "…" : t("settings.autoSupports")}</button>
                  <button disabled={working !== null || nAuto === 0} onClick={() => onSupports({ ...project.supports, list: list.filter((x) => x.source === "manual") })}>
                    {t("settings.clearSupports")}
                  </button>
                </div>
                {note && <p className="muted" role="status">{note}</p>}
                <div className="support-actions">
                  <h4 className="grow">{t("settings.supportList")}</h4>
                  <button onClick={addSupport}>{t("settings.addSupport")}</button>
                </div>
                {list.length > 0 && (
                  <table className="support-table">
                    <thead>
                      <tr><th>#</th><th>X</th><th>Y</th><th>Z</th><th /></tr>
                    </thead>
                    <tbody>
                      {list.map((sp) => (
                        <tr key={sp.id}>
                          <td className="muted" title={t(`settings.source.${sp.source}`)}>{sp.id}{sp.source === "manual" ? "*" : ""}</td>
                          {(["x", "y", "z"] as const).map((k) => (
                            <td key={k}>
                              <input type="number" step={0.1} value={Number(sp[k].toFixed(2))} onChange={(e) => setSupport(sp.id, { [k]: Number(e.currentTarget.value) })} />
                            </td>
                          ))}
                          <td><button className="icon-btn" onClick={() => removeSupport(sp.id)} title={t("settings.removeSupport")} aria-label={t("settings.removeSupport")}><Icon name="close" size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {rows && (
                  <table className="tilt-table">
                    <thead>
                      <tr>
                        <th>{t("settings.tiltCol")}</th>
                        <th>{t("settings.overhangCol")}</th>
                        <th>{t("settings.flatCol")}</th>
                        <th>{t("settings.sizeCol")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.tilt} className={i === 0 ? "best" : ""}>
                          <td>{r.tilt}°</td>
                          <td>{r.overhang.toFixed(1)}</td>
                          <td>{r.flat.toFixed(1)}</td>
                          <td>{r.fits ? r.size.map((n) => n.toFixed(0)).join(" × ") : t("settings.noFit")}</td>
                          <td><button disabled={s.printing.tilt === r.tilt} onClick={() => setP({ tilt: r.tilt })}>{t("settings.useTilt")}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
              <fieldset disabled={!s.printing.sprue}>
                <Field label={t("settings.sprueDiameter")}>
                  <Num value={s.printing.sprueDiameter} min={0.5} max={6} onChange={(v) => setP({ sprueDiameter: v })} unit="mm" />
                </Field>
                <Field label={t("settings.sprueLength")}>
                  <Num value={s.printing.sprueLength} min={1} max={20} step={0.5} onChange={(v) => setP({ sprueLength: v })} unit="mm" />
                </Field>
                <Field label={t("settings.spruePos")} hint={s.printing.sprueAt ? t("settings.sprueManual") : t("settings.sprueAuto")}>
                  <span className="num xyz">
                    {([0, 1, 2] as const).map((i) => (
                      <input key={i} type="number" step={0.1} disabled={!spruePos} value={spruePos ? Number(spruePos[i].toFixed(2)) : ""} onChange={(e) => setSpruePos(i, Number(e.currentTarget.value))} />
                    ))}
                    <button disabled={!s.printing.sprueAt} onClick={() => setP({ sprueAt: null })}>{t("settings.sprueReset")}</button>
                  </span>
                </Field>
              </fieldset>
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
              <div className="support-actions">
                <button disabled={analyzing} onClick={analyze}>{analyzing ? "…" : t("settings.analyze")}</button>
              </div>
              {reportError && <p className="bad" role="alert">{reportError}</p>}
              {report && (
                <div className="stat-row">
                  <div><span className="muted">{t("settings.trisNow")}</span><b>{report.stats.triangles.toLocaleString()}</b></div>
                  {report.simplify && (
                    <div>
                      <span className="muted">{t("settings.trisAfter")}</span>
                      <b>{report.simplify.accepted ? report.simplify.after.toLocaleString() : "—"}</b>
                      <span className="muted">
                        {report.simplify.accepted
                          ? t("settings.volumeChange", { pct: report.simplify.volumeChange.toFixed(3) })
                          : t(`settings.rejected.${report.simplify.reason}`)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "checks" && (
            <>
              <p className="muted">{t("settings.checksIntro")}</p>
              <div className="support-actions">
                <button disabled={analyzing} onClick={analyze}>{analyzing ? "…" : t("settings.analyze")}</button>
              </div>
              {reportError && <p className="bad" role="alert">{reportError}</p>}
              {report && (
                <>
                  <ul className="findings">
                    {report.findings.map((f, i) => (
                      <li key={i} className={f.level}>
                        <b>{t(`findings.level.${f.level}`)}</b> {t(`findings.${f.code}`, findingParams(f.detail))}
                        {f.at && f.at.length > 0 && (
                          <span className="muted at">
                            {" "}
                            {f.at.map((p) => `(${p.map((n) => n.toFixed(1)).join(", ")})`).join(" ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <h3>{t("settings.measure")}</h3>
                  <div className="stat-row">
                    <div><span className="muted">{t("preview.volume")}</span><b>{(report.stats.volume / 1000).toFixed(3)} cm³</b></div>
                    <div><span className="muted">{t("settings.surface")}</span><b>{report.stats.area.toFixed(1)} mm²</b></div>
                    <div><span className="muted">{t("preview.weight")} ({t(`metal.${s.material.metal}`)})</span><b>{((report.stats.volume / 1000) * DENSITY[s.material.metal]).toFixed(2)} g</b></div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
