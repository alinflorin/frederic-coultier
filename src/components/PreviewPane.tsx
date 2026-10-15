import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FcProject, ShadingMode } from "../types";
import { DENSITY, ROUGHNESS } from "../materials";
import { Viewer, type ViewerStats } from "./viewer/Viewer";
import { Gizmo } from "./viewer/Gizmo";
import { Icon } from "./Icon";

const MODES: ShadingMode[] = ["shaded", "edges", "wireframe", "xray"];

export function PreviewPane({
  project,
  onPatchRender,
}: {
  project: FcProject;
  onPatchRender: (p: Partial<FcProject["settings"]["render"]>) => void;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [stats, setStats] = useState<ViewerStats | null>(null);
  const [grid, setGrid] = useState(true);
  const [dimensions, setDimensions] = useState(false);
  const [turntable, setTurntable] = useState(false);
  const [menu, setMenu] = useState(false);

  const { render: r, material } = project.settings;
  const supTotal = project.supportCount.auto + project.supportCount.manual;

  useEffect(() => {
    if (!host.current) return;
    let v: Viewer;
    try {
      v = new Viewer(host.current);
    } catch {
      return; // WebGL unavailable
    }
    setViewer(v);
    setStats(v.stats);
    return () => {
      v.dispose();
      setViewer(null);
    };
  }, []);

  useEffect(() => {
    viewer?.setStyle({
      metalColor: r.metalColor,
      gemColor: r.gemColor,
      roughness: ROUGHNESS[r.finish],
      display: r.shading,
      ortho: r.orthographic,
      grid,
      dimensions,
      turntable,
    });
  }, [viewer, r, grid, dimensions, turntable]);

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
      <div className="viewport" tabIndex={0} onKeyDown={onKey}>
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

      <footer className="statusbar">
        <span className="ok"><Icon name="check" size={13} /> {t("preview.valid")}</span>
        {dims && <span>{dims} mm</span>}
        {stats && <span>{stats.tris.toLocaleString()} {t("preview.tris")}</span>}
        {stats && <span>{t("preview.volume")} {(stats.metalVolumeMm3 / 1000).toFixed(2)} cm³</span>}
        {stats && <span>{t("preview.weight")} ≈ {grams.toFixed(1)} g</span>}
        {project.settings.printing.supports.enabled && <span>{t("preview.supports", { count: supTotal })}</span>}
      </footer>
    </section>
  );
}
