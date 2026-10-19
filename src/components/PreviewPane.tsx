import { useEffect, useRef, useState } from "react";
import { ActionIcon, Anchor, Box, Button, Divider, Group, Menu, Slider, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import type { Attached, FcProject, ShadingMode } from "../types";
import { DENSITY, ROUGHNESS } from "../materials";
import { Viewer, type Pin, type Probe, type Section, type ViewerStats } from "./viewer/Viewer";
import type { Measurement, P3 } from "./viewer/measure";
import { FindingsCard, LocateCard, MeasurePanel, Readout } from "./viewer/Panels";
import { Gizmo } from "./viewer/Gizmo";
import { Annotator } from "./viewer/Annotator";
import { extraChecks, locateSource, meshHealth, meshReport, type Diagnostic, type Finding, type Health, type PrintLayout, type RenderError, type SourceHit } from "../api";
import type { MeshBuf } from "./viewer/geometry";
import { Icon } from "./Icon";

const MODES: ShadingMode[] = ["shaded", "edges", "wireframe", "xray"];

export interface RenderState {
  status: "idle" | "rendering" | "ok" | "error";
  mesh: MeshBuf | null;
  ms?: number;
  error?: RenderError;
  diagnostics: Diagnostic[];
  echoes: string[];
  /** The source this result belongs to, so a caller can tell a fresh result from a stale one. */
  source?: string;
}

export function PreviewPane({
  project,
  render,
  layout,
  printView,
  onTogglePrintView,
  onPickSupport,
  onPickSprue,
  onPatchRender,
  onStats,
  onViewer,
  onAnnotated,
  onLocate,
}: {
  project: FcProject;
  render: RenderState;
  /** The piece as printed (tilted, with supports), when supports are enabled. */
  layout: PrintLayout | null;
  printView: boolean;
  onTogglePrintView: () => void;
  /** Support editing: a click on the model (add) or on a support (remove), in print coordinates. */
  onPickSupport: (kind: "model" | "support", point: [number, number, number]) => void;
  /** Sprue-move mode: a click on the piece, in print coordinates. */
  onPickSprue: (point: [number, number, number]) => void;
  onPatchRender: (p: Partial<FcProject["settings"]["render"]>) => void;
  onStats: (s: ViewerStats | null) => void;
  /** The 3D viewer, once it exists (null again when it goes away). */
  onViewer?: (v: Viewer | null) => void;
  /** Drawing on the view to show the agent: given, the tool is offered and its picture goes here. */
  onAnnotated?: (picture: Attached) => void;
  /** The statement of the source a clicked spot comes from, to show in the editor (null = none). */
  onLocate?: (hit: SourceHit | null) => void;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [stats, setStats] = useState<ViewerStats | null>(null);
  const [grid, setGrid] = useState(true);
  const [dimensions, setDimensions] = useState(false);
  const [axes, setAxes] = useState(false);
  const [cut, setCut] = useState(false);
  const [section, setSection] = useState<Section>({ axis: "z", t: 0.5, flip: false });
  const [turntable, setTurntable] = useState(false);
  const compact = useMediaQuery("(max-width: 899px)");
  const [console_, setConsole] = useState(false);
  const [annotate, setAnnotate] = useState(false);
  const [editMode, setEditMode] = useState<"supports" | "sprue" | "measure" | "locate" | null>(null);
  const toggleEdit = (m: "supports" | "sprue" | "measure" | "locate") => setEditMode((v) => (v === m ? null : m));
  // analysis: what the piece is like, drawn over it. None of it is part of a picture unless asked for.
  const [overhangOn, setOverhangOn] = useState(false);
  const [healthOn, setHealthOn] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [findingsOn, setFindingsOn] = useState(false);
  const [found, setFound] = useState<{ items: { n: number; f: Finding }[] | null; busy: boolean; error: string | null }>({ items: null, busy: false, error: null });
  const [probeOn, setProbeOn] = useState(false);
  const [readout, setReadout] = useState<Probe | null>(null);
  const [mPoints, setMPoints] = useState<P3[]>([]);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [located, setLocated] = useState<{ hits: SourceHit[] | null; truncated: boolean; busy: boolean; current: SourceHit | null }>({ hits: null, truncated: false, busy: false, current: null });
  const probeFrame = useRef(0);
  const down = useRef<{ x: number; y: number } | null>(null);

  const { render: r, material } = project.settings;
  const supTotal = project.supports.list.length;
  const supOn = project.settings.printing.supports.enabled;
  const sprueOn = project.settings.printing.sprue;
  const showLayout = layout && (!supOn || printView);
  const editSup = !annotate && editMode === "supports" && supOn && printView;
  const editSprue = !annotate && editMode === "sprue" && sprueOn && !!showLayout;
  const measuring = !annotate && editMode === "measure";
  const locating = !annotate && editMode === "locate";
  const pr = project.settings.printing;
  // the build direction in scene coordinates: straight up in the print layout, tilted for the piece as modelled
  const tiltRad = ((showLayout || !supOn ? 0 : pr.tilt) * Math.PI) / 180;
  const buildUp: P3 = showLayout ? [0, 0, 1] : [0, Math.sin(tiltRad), Math.cos(tiltRad)];
  const upKey = buildUp.join(",");
  const checkKey = JSON.stringify([extraChecks(project), pr.minWall, project.settings.material.process]);
  const renderedSource = render.source ?? project.source;
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
    onViewer?.(viewer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  useEffect(() => {
    viewer?.setStyle({
      metalColor: r.metalColor,
      roughness: ROUGHNESS[r.finish],
      display: r.shading,
      ortho: r.orthographic,
      grid,
      dimensions,
      axes,
      turntable,
    });
  }, [viewer, r, grid, dimensions, axes, turntable]);

  useEffect(() => {
    viewer?.setSection(cut ? section : null);
  }, [viewer, cut, section]);

  useEffect(() => {
    if (!viewer) return;
    const st = showLayout ? viewer.setMesh(layout.model, layout.supports, layout.sprue) : viewer.setMesh(render.mesh);
    setStats(st);
    onStats(st);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, render.mesh, layout, showLayout]);

  useEffect(() => {
    viewer?.setFrame(showLayout ? layout.tilt : 0, showLayout ? layout.zoff : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, showLayout, layout]);

  useEffect(() => {
    viewer?.setBuildUp(buildUp);
    viewer?.setOverhang(overhangOn ? { up: buildUp, angle: project.settings.printing.supports.overhangAngle } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, overhangOn, upKey, project.settings.printing.supports.overhangAngle]);

  useEffect(() => {
    if (!viewer || !healthOn || render.status !== "ok" || !render.mesh) {
      viewer?.setHealth(null);
      setHealth(null);
      return;
    }
    let live = true;
    meshHealth(renderedSource)
      .then((h) => {
        if (!live) return;
        viewer.setHealth(h);
        setHealth(h);
      })
      .catch(() => live && setHealth(null));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, healthOn, render.mesh]);

  useEffect(() => {
    if (!viewer || !findingsOn || render.status !== "ok" || !render.mesh) {
      viewer?.setPins(null);
      setFound({ items: null, busy: false, error: null });
      return;
    }
    let live = true;
    setFound((f) => ({ ...f, busy: true, error: null }));
    meshReport(renderedSource, undefined, { minWall: pr.minWall, minGap: 0.3, casting: project.settings.material.process === "casting" }, extraChecks(project))
      .then((r) => {
        if (!live) return;
        // the ones with a place on the piece get a number; the pin on the piece wears the same
        const items = r.findings
          .filter((f) => (f.level === "warn" || f.level === "fail") && f.at?.length)
          .map((f, i) => ({ n: i + 1, f }));
        const pins: Pin[] = items.flatMap(({ n, f }) =>
          (f.at ?? []).map((at) => ({ at, text: String(n), color: f.level === "fail" ? "#d93025" : "#e8890c" })),
        );
        viewer.setPins(pins);
        setFound({ items, busy: false, error: null });
      })
      .catch((e) => {
        if (!live) return;
        viewer.setPins(null);
        setFound({ items: null, busy: false, error: typeof e === "string" ? e : e instanceof Error ? e.message : String(e) });
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, findingsOn, render.mesh, checkKey]);

  // measuring: the points picked so far, drawn on the piece
  useEffect(() => {
    if (!viewer) return;
    setMeasurement(viewer.setMeasure(measuring ? mPoints : []));
  }, [viewer, measuring, mPoints]);
  useEffect(() => {
    if (!measuring) setMPoints([]);
  }, [measuring]);
  useEffect(() => {
    if (!locating) {
      setLocated({ hits: null, truncated: false, busy: false, current: null });
      onLocate?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locating]);
  useEffect(() => {
    if (!probeOn) setReadout(null);
  }, [probeOn]);

  async function locateAt(clientX: number, clientY: number) {
    const hit = viewer?.probe(clientX, clientY);
    if (!hit) return;
    if (hit.kind !== "model") {
      setLocated({ hits: [], truncated: false, busy: false, current: null });
      return;
    }
    setLocated({ hits: null, truncated: false, busy: true, current: null });
    try {
      const r = await locateSource(renderedSource, hit.model);
      const leaf = [...r.hits].reverse().find((h) => h.leaf) ?? r.hits[r.hits.length - 1] ?? null;
      setLocated({ hits: r.hits, truncated: r.truncated, busy: false, current: leaf });
      onLocate?.(leaf);
    } catch {
      setLocated({ hits: [], truncated: false, busy: false, current: null });
    }
  }

  const cycle = () => onPatchRender({ shading: MODES[(MODES.indexOf(r.shading) + 1) % MODES.length] });
  const onKey = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.key === "Escape") setEditMode(null);
    else if (k === "f") viewer?.fit();
    else if (k === "o") onPatchRender({ orthographic: !r.orthographic });
    else if (k === "w") cycle();
    else if (k === "g") setGrid((g) => !g);
  };

  const dims = stats?.size.map((n) => n.toFixed(1)).join(" × ");
  const grams = stats ? (stats.metalVolumeMm3 / 1000) * DENSITY[material.metal] : 0;

  const tool = (on: boolean) => ({
    variant: on ? "filled" : "subtle",
    color: on ? "gold" : "gray",
    size: compact ? 40 : 34,
    "aria-pressed": on,
  }) as const;
  const floating = { bg: "var(--surface)", bd: "1px solid var(--border)", style: { borderRadius: 8, boxShadow: "var(--shadow)" } } as const;

  return (
    <Stack component="section" gap={0} pos="relative" bg="var(--surface)" aria-label={t("preview.title")} style={{ minWidth: 0, minHeight: 0 }}>
      <Box
        pos="relative"
        tabIndex={0}
        onKeyDown={onKey}
        bg="var(--vp-bg)"
        style={{ flex: 1, minHeight: 160, overflow: "hidden", outline: "none", cursor: editSup || editSprue || measuring || locating ? "crosshair" : undefined }}
        onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
        onPointerLeave={() => setReadout(null)}
        onPointerMove={(e) => {
          if (!probeOn || e.buttons || !viewer) return;
          const { clientX, clientY } = e;
          cancelAnimationFrame(probeFrame.current);
          probeFrame.current = requestAnimationFrame(() => setReadout(viewer.probe(clientX, clientY)));
        }}
        onPointerUp={(e) => {
          const d = down.current;
          down.current = null;
          if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
          if ((e.target as HTMLElement).closest("[data-vp-ui]")) return;
          if (measuring) {
            const hit = viewer?.pick(e.clientX, e.clientY);
            if (hit) setMPoints((cur) => (cur.length >= 3 ? [hit.point] : [...cur, hit.point]));
            return;
          }
          if (locating) {
            void locateAt(e.clientX, e.clientY);
            return;
          }
          if (!(editSup || editSprue) || !showLayout) return;
          const hit = viewer?.pick(e.clientX, e.clientY);
          if (!hit) return;
          if (editSprue) {
            if (hit.kind === "model") onPickSprue(hit.point);
          } else onPickSupport(hit.kind, hit.point);
        }}
      >
        <Box ref={host} pos="absolute" inset={0} />
        <Gizmo viewer={viewer} />
        {annotate && onAnnotated && <Annotator viewer={viewer} onSend={onAnnotated} onClose={() => setAnnotate(false)} />}
        {probeOn && readout && !measuring && !locating && <Readout probe={readout} minWall={pr.minWall} overhangAngle={project.settings.printing.supports.overhangAngle} />}
        {measuring && <MeasurePanel points={mPoints.length} m={measurement} onClear={() => setMPoints([])} onClose={() => setEditMode(null)} />}
        {locating && (
          <LocateCard
            hits={located.hits}
            truncated={located.truncated}
            busy={located.busy}
            current={located.current}
            onPick={(h) => {
              setLocated((l) => ({ ...l, current: h }));
              onLocate?.(h);
            }}
            onClose={() => setEditMode(null)}
          />
        )}
        {findingsOn && (
          <FindingsCard items={found.items} busy={found.busy} error={found.error} onFocus={(f) => f.at?.[0] && viewer?.focus(f.at[0])} onClose={() => setFindingsOn(false)} />
        )}

        <Stack
          data-vp-ui
          gap={4}
          p={4}
          pos="absolute"
          top={10}
          right={10}
          bd="1px solid var(--border)"
          onPointerDown={(e) => e.stopPropagation()}
          style={{ zIndex: 5, borderRadius: 10, background: "color-mix(in srgb, var(--surface) 82%, transparent)", backdropFilter: "blur(8px)" }}
        >
          <ActionIcon variant="subtle" color="gray" size={compact ? 40 : 34} onClick={() => viewer?.fit()} title={t("preview.fit")} aria-label={t("preview.fit")}>
            <Icon name="fit" size={18} />
          </ActionIcon>
          <ActionIcon {...tool(r.orthographic)} onClick={() => onPatchRender({ orthographic: !r.orthographic })} title={t("preview.orthoHint")} aria-label={t("preview.ortho")}>
            <Icon name="ortho" size={18} />
          </ActionIcon>
          <Menu position="left-start" offset={8} shadow="md" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size={compact ? 40 : 34} title={t("preview.display")} aria-label={t("preview.display")}>
                <Icon name="layers" size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown miw={130}>
              {MODES.map((m) => (
                <Menu.Item key={m} role="menuitemradio" aria-checked={r.shading === m} c={r.shading === m ? "var(--accent)" : undefined} bg={r.shading === m ? "var(--accent-soft)" : undefined} onClick={() => onPatchRender({ shading: m })}>
                  {t(`preview.shading.${m}`)}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <Menu position="left-start" offset={8} shadow="md" withinPortal closeOnItemClick={false}>
            <Menu.Target>
              <ActionIcon {...tool(overhangOn || healthOn || findingsOn || probeOn || measuring || locating)} title={t("analysis.title")} aria-label={t("analysis.title")}>
                <Icon name="scan" size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown miw={200}>
              {(
                [
                  ["overhang", overhangOn, () => setOverhangOn((v) => !v)],
                  ["health", healthOn, () => setHealthOn((v) => !v)],
                  ["findings", findingsOn, () => setFindingsOn((v) => !v)],
                  ["probe", probeOn, () => setProbeOn((v) => !v)],
                  ["measure", measuring, () => toggleEdit("measure")],
                  ["locate", locating, () => toggleEdit("locate")],
                ] as const
              ).map(([id, on, toggle]) => (
                <Menu.Item key={id} role="menuitemcheckbox" aria-checked={on} c={on ? "var(--accent)" : undefined} bg={on ? "var(--accent-soft)" : undefined} onClick={toggle} title={t(`analysis.${id}Hint`)}>
                  {t(`analysis.${id}`)}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          {supOn && (
            <ActionIcon {...tool(printView)} onClick={onTogglePrintView} title={t("preview.printView")} aria-label={t("preview.printView")}>
              <Icon name="supports" size={18} />
            </ActionIcon>
          )}
          {supOn && printView && (
            <ActionIcon {...tool(editSup)} onClick={() => toggleEdit("supports")} title={t("preview.editSupports")} aria-label={t("preview.editSupports")}>
              <Icon name="plus" size={18} />
            </ActionIcon>
          )}
          {sprueOn && showLayout && (
            <ActionIcon {...tool(editSprue)} onClick={() => toggleEdit("sprue")} title={t("preview.moveSprue")} aria-label={t("preview.moveSprue")}>
              <Icon name="sprue" size={18} />
            </ActionIcon>
          )}
          <Divider mx={4} />
          <ActionIcon {...tool(grid)} onClick={() => setGrid(!grid)} title={t("preview.grid")} aria-label={t("preview.grid")}>
            <Icon name="grid" size={18} />
          </ActionIcon>
          <ActionIcon {...tool(dimensions)} onClick={() => setDimensions(!dimensions)} title={t("preview.dimensions")} aria-label={t("preview.dimensions")}>
            <Icon name="ruler" size={18} />
          </ActionIcon>
          <ActionIcon {...tool(axes)} onClick={() => setAxes(!axes)} title={t("preview.axes")} aria-label={t("preview.axes")}>
            <Icon name="axes" size={18} />
          </ActionIcon>
          <ActionIcon {...tool(cut)} onClick={() => setCut(!cut)} title={t("preview.section")} aria-label={t("preview.section")}>
            <Icon name="section" size={18} />
          </ActionIcon>
          {onAnnotated && (
            <ActionIcon {...tool(annotate)} onClick={() => setAnnotate(!annotate)} title={t("annotate.title")} aria-label={t("annotate.title")}>
              <Icon name="pen" size={18} />
            </ActionIcon>
          )}
          <ActionIcon {...tool(turntable)} onClick={() => setTurntable(!turntable)} title={t("preview.turntable")} aria-label={t("preview.turntable")}>
            <Icon name="rotate" size={18} />
          </ActionIcon>
        </Stack>
      </Box>

      {cut && (
        <Group data-vp-ui gap={6} px={8} py={6} wrap="nowrap" pos="absolute" left={12} bottom={44} {...floating} style={{ ...floating.style, zIndex: 5 }} onPointerDown={(e) => e.stopPropagation()}>
          {(["x", "y", "z"] as const).map((a) => (
            <Button key={a} size="compact-xs" variant={section.axis === a ? "filled" : "default"} onClick={() => setSection({ ...section, axis: a })}>
              {a.toUpperCase()}
            </Button>
          ))}
          <Slider w={160} size="sm" label={null} min={0} max={1} step={0.005} value={section.t} aria-label={t("preview.section")} onChange={(v) => setSection({ ...section, t: v })} />
          <Button size="compact-xs" variant={section.flip ? "filled" : "default"} aria-pressed={section.flip} onClick={() => setSection({ ...section, flip: !section.flip })}>
            {t("preview.sectionFlip")}
          </Button>
        </Group>
      )}

      {render.status === "error" && render.error && (
        <Group role="alert" gap={8} wrap="nowrap" px={12} py={6} pos="absolute" top={12} left="50%" c="var(--bad)" fz={13} bg="var(--surface)" bd="1px solid var(--bad)" style={{ transform: "translateX(-50%)", maxWidth: "calc(100% - 140px)", borderRadius: 8, zIndex: 4 }}>
          <Icon name="warn" size={15} />
          <span>
            {render.error.line ? t("preview.line", { line: render.error.line }) + ": " : ""}
            {render.error.message}
          </span>
        </Group>
      )}
      {render.status === "ok" && !render.mesh && (
        <Group px={12} py={6} pos="absolute" top={12} left="50%" fz={13} bg="var(--surface)" bd="1px solid var(--border)" style={{ transform: "translateX(-50%)", maxWidth: "calc(100% - 140px)", borderRadius: 8, zIndex: 4 }}>
          {t("preview.empty")}
        </Group>
      )}

      {console_ && (
        <Box component="ul" aria-label={t("preview.console")} m={0} px={12} py={6} bg="var(--code-bg)" bd="0 solid var(--border)" ff="monospace" fz={12} style={{ listStyle: "none", maxHeight: 140, overflow: "auto", borderTopWidth: 1, lineHeight: 1.5, flex: "none" }}>
          {render.diagnostics.map((d, i) => (
            <Box component="li" key={`d${i}`} c={d.severity === "error" ? "var(--bad)" : "var(--accent)"}>
              {d.line ? `${t("preview.line", { line: d.line })}: ` : ""}
              {d.message}
            </Box>
          ))}
          {render.echoes.map((e, i) => (
            <Box component="li" key={`e${i}`} c="dimmed">{e}</Box>
          ))}
        </Box>
      )}

      <Group component="footer" gap="4px 16px" px={12} py={7} fz={12} c="dimmed" bd="0 solid var(--border)" style={{ flex: "none", borderTopWidth: 1 }}>
        {render.status === "rendering" && <Text span inherit c="var(--accent)">{t("preview.rendering")}</Text>}
        {render.status === "error" && <Group gap={4} c="var(--bad)"><Icon name="warn" size={13} /> {t("preview.failed")}</Group>}
        {render.status === "ok" && (
          <Group gap={4} c="var(--ok)"><Icon name="check" size={13} /> {t("preview.rendered", { ms: render.ms })}</Group>
        )}
        {dims && <span>{dims} mm</span>}
        {stats && <span>{stats.tris.toLocaleString()} {t("preview.tris")}</span>}
        {stats && <span>{t("preview.volume")} {(stats.metalVolumeMm3 / 1000).toFixed(2)} cm³</span>}
        {stats && <span>{t("preview.weight")} ≈ {grams.toFixed(1)} g</span>}
        {supOn && <span>{t("preview.supports", { count: supTotal })}</span>}
        {healthOn && health && (
          <Group gap={4} c={health.open.length + health.nonManifold.length + health.winding.length + health.degenerate.length ? "var(--bad)" : "var(--ok)"}>
            <Icon name={health.open.length + health.nonManifold.length + health.winding.length + health.degenerate.length ? "warn" : "check"} size={13} />
            {health.open.length + health.nonManifold.length + health.winding.length + health.degenerate.length
              ? t("analysis.healthBad", { open: health.open.length, shared: health.nonManifold.length, flipped: health.winding.length, empty: health.degenerate.length })
              : t("analysis.healthOk")}
          </Group>
        )}
        {showLayout && !layout.fits && <Group gap={4} c="var(--bad)"><Icon name="warn" size={13} /> {t("preview.noFit", { size: layout.size.map((n) => n.toFixed(0)).join(" × ") })}</Group>}
        {(render.diagnostics.length > 0 || render.echoes.length > 0) && (
          <Anchor component="button" type="button" fz={12} ml="auto" c="var(--accent)" aria-expanded={console_} onClick={() => setConsole((c) => !c)}>
            {t("preview.messages", { count: render.diagnostics.length + render.echoes.length })}
          </Anchor>
        )}
      </Group>
    </Stack>
  );
}
