import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FcProject, ShadingMode } from "../types";
import { DENSITY, ROUGHNESS } from "../materials";
import { Viewer, type ViewerStats } from "./viewer/Viewer";
import { Gizmo } from "./viewer/Gizmo";
import type { Diagnostic, PrintLayout, RenderError } from "../api";
import { Icon } from "./Icon";

const MODES: ShadingMode[] = ["shaded", "edges", "wireframe", "xray"];

export interface RenderState {
  status: "idle" | "rendering" | "ok" | "error";
  mesh: ArrayBuffer | null;
  ms?: number;
  error?: RenderError;
  diagnostics: Diagnostic[];
  echoes: string[];
}

export function PreviewPane({
  project,
  render,
  layout,
  printView,
  onTogglePrintView,
  onPickSupport,
  onPatchRender,
  onStats,
}: {
  project: FcProject;
  render: RenderState;
  /** The piece as printed (tilted, with supports), when supports are enabled. */
  layout: PrintLayout | null;
  printView: boolean;
  onTogglePrintView: () => void;
  /** Support editing: a click on the model (add) or on a support (remove), in print coordinates. */
  onPickSupport: (kind: "model" | "support", point: [number, number, number]) => void;
  onPatchRender: (p: Partial<FcProject["settings"]["render"]>) => void;
  onStats: (s: ViewerStats | null) => void;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [stats, setStats] = useState<ViewerStats | null>(null);
  const [grid, setGrid] = useState(true);
  const [dimensions, setDimensions] = useState(false);
  const [turntable, setTurntable] = useState(false);
  const [menu, setMenu] = useState(false);
  const [console_, setConsole] = useState(false);
  const [editSup, setEditSup] = useState(false);
  const down = useRef<{ x: number; y: number } | null>(null);

  const { render: r, material } = project.settings;
  const supTotal = project.supports.list.length;
  const supOn = project.settings.printing.supports.enabled;
  const showLayout = layout && (!supOn || printView);

  useEffect(() => {
    if (!host.current) return;
    let v: Viewer;
    try {
      v = new Viewer(host.current);
    } catch {
      return; // WebGL unavailable
    }
    setViewer(v);
    return () => {
      v.dispose();
      setViewer(null);
    };
  }, []);

  useEffect(() => {
    viewer?.setStyle({
      metalColor: r.metalColor,
      roughness: ROUGHNESS[r.finish],
      display: r.shading,
      ortho: r.orthographic,
      grid,
      dimensions,
      turntable,
    });
  }, [viewer, r, grid, dimensions, turntable]);

  useEffect(() => {
    if (!viewer) return;
    const st = showLayout ? viewer.setMesh(layout.model, layout.supports) : viewer.setMesh(render.mesh);
    setStats(st);
    onStats(st);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, render.mesh, layout, showLayout]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  const cycle = () => onPatchRender({ shading: MODES[(MODES.indexOf(r.shading) + 1) % MODES.length] });
  const onKey = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "f") viewer?.fit();
    else if (k === "o") onPatchRender({ orthographic: !r.orthographic });
    else if (k === "w") cycle();
    else if (k === "g") setGrid((g) => !g);
  };

  const dims = stats?.size.map((n) => n.toFixed(1)).join(" × ");
  const grams = stats ? (stats.metalVolumeMm3 / 1000) * DENSITY[material.metal] : 0;

  return (
    <section className="pane preview-pane" aria-label={t("preview.title")}>
      <div
        className={`viewport${editSup ? " editing" : ""}`}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const d = down.current;
          down.current = null;
          if (!editSup || !showLayout || !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
          if ((e.target as HTMLElement).closest(".vp-tools")) return;
          const hit = viewer?.pick(e.clientX, e.clientY);
          if (hit) onPickSupport(hit.kind, hit.point);
        }}
      >
        <div className="vp-host" ref={host} />
        <Gizmo viewer={viewer} />

        <div className="vp-tools" onPointerDown={(e) => e.stopPropagation()}>
          <button className="vp-btn" onClick={() => viewer?.fit()} title={t("preview.fit")} aria-label={t("preview.fit")}>
            <Icon name="fit" size={18} />
          </button>
          <button
            className={`vp-btn${r.orthographic ? " on" : ""}`}
            aria-pressed={r.orthographic}
            onClick={() => onPatchRender({ orthographic: !r.orthographic })}
            title={t("preview.orthoHint")}
            aria-label={t("preview.ortho")}
          >
            <Icon name="ortho" size={18} />
          </button>
          <div className="vp-menu">
            <button
              className={`vp-btn${menu ? " on" : ""}`}
              aria-haspopup="true"
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
              title={t("preview.display")}
              aria-label={t("preview.display")}
            >
              <Icon name="layers" size={18} />
            </button>
            {menu && (
              <ul className="vp-pop" role="menu">
                {MODES.map((m) => (
                  <li key={m}>
                    <button
                      role="menuitemradio"
                      aria-checked={r.shading === m}
                      className={r.shading === m ? "on" : ""}
                      onClick={() => {
                        onPatchRender({ shading: m });
                        setMenu(false);
                      }}
                    >
                      {t(`preview.shading.${m}`)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {supOn && (
            <button
              className={`vp-btn${printView ? " on" : ""}`}
              aria-pressed={printView}
              onClick={onTogglePrintView}
              title={t("preview.printView")}
              aria-label={t("preview.printView")}
            >
              <Icon name="supports" size={18} />
            </button>
          )}
          {supOn && printView && (
            <button
              className={`vp-btn${editSup ? " on" : ""}`}
              aria-pressed={editSup}
              onClick={() => setEditSup((v) => !v)}
              title={t("preview.editSupports")}
              aria-label={t("preview.editSupports")}
            >
              <Icon name="plus" size={18} />
            </button>
          )}
          <span className="vp-sep" />
          <button className={`vp-btn${grid ? " on" : ""}`} aria-pressed={grid} onClick={() => setGrid(!grid)} title={t("preview.grid")} aria-label={t("preview.grid")}>
            <Icon name="grid" size={18} />
          </button>
          <button className={`vp-btn${dimensions ? " on" : ""}`} aria-pressed={dimensions} onClick={() => setDimensions(!dimensions)} title={t("preview.dimensions")} aria-label={t("preview.dimensions")}>
            <Icon name="ruler" size={18} />
          </button>
          <button className={`vp-btn${turntable ? " on" : ""}`} aria-pressed={turntable} onClick={() => setTurntable(!turntable)} title={t("preview.turntable")} aria-label={t("preview.turntable")}>
            <Icon name="rotate" size={18} />
          </button>
        </div>
      </div>

      {render.status === "error" && render.error && (
        <div className="vp-banner error" role="alert">
          <Icon name="warn" size={15} />
          <span>
            {render.error.line ? t("preview.line", { line: render.error.line }) + ": " : ""}
            {render.error.message}
          </span>
        </div>
      )}
      {render.status === "ok" && !render.mesh && (
        <div className="vp-banner">{t("preview.empty")}</div>
      )}

      {console_ && (
        <ul className="diag" aria-label={t("preview.console")}>
          {render.diagnostics.map((d, i) => (
            <li key={`d${i}`} className={d.severity}>
              {d.line ? `${t("preview.line", { line: d.line })}: ` : ""}
              {d.message}
            </li>
          ))}
          {render.echoes.map((e, i) => (
            <li key={`e${i}`} className="echo">{e}</li>
          ))}
        </ul>
      )}

      <footer className="statusbar">
        {render.status === "rendering" && <span className="busy">{t("preview.rendering")}</span>}
        {render.status === "error" && <span className="bad"><Icon name="warn" size={13} /> {t("preview.failed")}</span>}
        {render.status === "ok" && (
          <span className="ok"><Icon name="check" size={13} /> {t("preview.rendered", { ms: render.ms })}</span>
        )}
        {dims && <span>{dims} mm</span>}
        {stats && <span>{stats.tris.toLocaleString()} {t("preview.tris")}</span>}
        {stats && <span>{t("preview.volume")} {(stats.metalVolumeMm3 / 1000).toFixed(2)} cm³</span>}
        {stats && <span>{t("preview.weight")} ≈ {grams.toFixed(1)} g</span>}
        {supOn && <span>{t("preview.supports", { count: supTotal })}</span>}
        {showLayout && !layout.fits && <span className="bad"><Icon name="warn" size={13} /> {t("preview.noFit", { size: layout.size.map((n) => n.toFixed(0)).join(" × ") })}</span>}
        {(render.diagnostics.length > 0 || render.echoes.length > 0) && (
          <button className="link" aria-expanded={console_} onClick={() => setConsole((c) => !c)}>
            {t("preview.messages", { count: render.diagnostics.length + render.echoes.length })}
          </button>
        )}
      </footer>
    </section>
  );
}
