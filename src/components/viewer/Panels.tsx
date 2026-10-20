import { ActionIcon, Box, Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { Finding, SourceHit } from "../../api";
import { findingText } from "../../findings";
import type { Measurement } from "./measure";
import type { Probe } from "./Viewer";
import { Icon } from "../Icon";

const card = { className: "glass", style: { borderRadius: 12, zIndex: 5, pointerEvents: "auto" as const } };
const num = (n: number, d = 2) => n.toFixed(d);

/** The numbers under the pointer: where, how much metal is behind, which way the surface faces. */
export function Readout({ probe, minWall, overhangAngle }: { probe: Probe; minWall: number; overhangAngle: number }) {
  const { t } = useTranslation();
  const [x, y, z] = probe.model;
  // 180° is a flat ceiling; within `overhangAngle` of it needs support
  const ceiling = 180 - probe.incline;
  const needs = ceiling <= overhangAngle;
  const slope = probe.incline < 5 ? t("analysis.flatUp") : ceiling < 5 ? t("analysis.flatDown") : Math.abs(probe.incline - 90) < 5 ? t("analysis.wall") : "";
  return (
    <Box data-vp-ui pos="absolute" top={92} left={12} px={10} py={6} fz={12} ff="monospace" {...card} style={{ ...card.style, pointerEvents: "none", lineHeight: 1.55 }} role="status">
      {probe.kind === "support" ? (
        <Text inherit c="dimmed">{t("analysis.supportPart")}</Text>
      ) : (
        <>
          <div>X {num(x)}  Y {num(y)}  Z {num(z)} mm</div>
          <div>
            {t("analysis.wallThickness")}{" "}
            {probe.thickness === null ? (
              "—"
            ) : (
              <Text span inherit fw={700} c={probe.thickness < minWall ? "var(--bad)" : undefined}>
                {num(probe.thickness)} mm{probe.thickness < minWall ? ` < ${num(minWall, 1)}` : ""}
              </Text>
            )}
          </div>
          <div>
            {t("analysis.slope")} {num(probe.incline, 0)}° {slope && <Text span inherit c="dimmed">({slope})</Text>}
            {needs && <Text span inherit fw={700} c="var(--warn)"> {t("analysis.needsSupport")}</Text>}
          </div>
        </>
      )}
    </Box>
  );
}

/** What the picked points say: distances, the angle at the middle one, the circle through three. */
export function MeasurePanel({ points, m, onClear, onClose }: { points: number; m: Measurement | null; onClear: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const d = m?.circle ? m.circle.radius * 2 : null;
  return (
    <Stack data-vp-ui gap={2} pos="absolute" top={92} left={12} px={10} py={6} fz={12} ff="monospace" {...card} style={{ ...card.style, lineHeight: 1.55, maxWidth: 280 }} onPointerDown={(e) => e.stopPropagation()}>
      <Group gap={6} justify="space-between" wrap="nowrap">
        <Text inherit fw={700} ff="sans-serif">{t("analysis.measure")}</Text>
        <Group gap={0} wrap="nowrap">
          <ActionIcon size={22} variant="subtle" color="gray" onClick={onClear} title={t("analysis.reset")} aria-label={t("analysis.reset")}><Icon name="rotate" size={13} /></ActionIcon>
          <ActionIcon size={22} variant="subtle" color="gray" onClick={onClose} title={t("analysis.done")} aria-label={t("analysis.done")}><Icon name="close" size={13} /></ActionIcon>
        </Group>
      </Group>
      {!m ? (
        <Text inherit c="dimmed" ff="sans-serif">{points === 0 ? t("analysis.measureStart") : t("analysis.measureNext")}</Text>
      ) : (
        <>
          <div>{t("analysis.distance")} <b>{num(m.distance)} mm</b></div>
          <div style={{ opacity: 0.75 }}>Δ {num(m.delta[0])}, {num(m.delta[1])}, {num(m.delta[2])}</div>
          {m.angle !== undefined && <div>{t("analysis.angle")} <b>{num(m.angle, 1)}°</b></div>}
          {d !== null && m.circle && m.circle.radius < 500 && (
            <div>
              {t("analysis.circle")} Ø <b>{num(d)} mm</b> · R {num(m.circle.radius)}
              <div style={{ opacity: 0.75 }}>{t("analysis.ringSize", { eu: num(d * Math.PI, 1) })}</div>
            </div>
          )}
        </>
      )}
    </Stack>
  );
}

const LEVEL_COLOR = { fail: "var(--bad)", warn: "var(--warn)", info: "var(--muted)", pass: "var(--ok)" } as const;

/** The findings that have a place on the piece, numbered like their pins. */
export function FindingsCard({ items, busy, error, onFocus, onClose }: {
  items: { n: number; f: Finding }[] | null;
  busy: boolean;
  error: string | null;
  onFocus: (f: Finding) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack data-vp-ui gap={4} pos="absolute" top={10} right={64} px={10} py={8} fz={12} {...card} style={{ ...card.style, maxWidth: 330, maxHeight: "60%", overflow: "auto" }} onPointerDown={(e) => e.stopPropagation()}>
      <Group gap={6} justify="space-between" wrap="nowrap">
        <Text inherit fw={700}>{t("analysis.findings")}</Text>
        <ActionIcon size={22} variant="subtle" color="gray" onClick={onClose} title={t("analysis.done")} aria-label={t("analysis.done")}><Icon name="close" size={13} /></ActionIcon>
      </Group>
      {busy && <Text inherit c="dimmed">{t("analysis.checking")}</Text>}
      {error && <Text inherit c="var(--bad)" role="alert">{error}</Text>}
      {!busy && !error && items?.length === 0 && <Text inherit c="var(--ok)">{t("analysis.nothing")}</Text>}
      {items?.map(({ n, f }) => (
        <Group key={n} gap={8} wrap="nowrap" align="flex-start" style={{ cursor: f.at?.length ? "pointer" : undefined }} onClick={() => f.at?.length && onFocus(f)}>
          <Text span inherit fw={700} c="#fff" bg={LEVEL_COLOR[f.level]} px={6} style={{ borderRadius: 9, flex: "none" }}>{n}</Text>
          <Text span inherit>{findingText(t, f)}</Text>
        </Group>
      ))}
    </Stack>
  );
}

/** Where the spot comes from: the statements that make it, innermost first. */
export function LocateCard({ hits, truncated, busy, current, onPick, onClose }: {
  hits: SourceHit[] | null;
  truncated: boolean;
  busy: boolean;
  current: SourceHit | null;
  onPick: (h: SourceHit) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const chain = hits ? [...hits].reverse() : [];
  return (
    <Stack data-vp-ui gap={2} pos="absolute" top={92} left={12} px={10} py={6} fz={12} {...card} style={{ ...card.style, maxWidth: 340 }} onPointerDown={(e) => e.stopPropagation()}>
      <Group gap={6} justify="space-between" wrap="nowrap">
        <Text inherit fw={700}>{t("analysis.locate")}</Text>
        <ActionIcon size={22} variant="subtle" color="gray" onClick={onClose} title={t("analysis.done")} aria-label={t("analysis.done")}><Icon name="close" size={13} /></ActionIcon>
      </Group>
      {busy ? (
        <Text inherit c="dimmed">{t("analysis.searching")}</Text>
      ) : !hits ? (
        <Text inherit c="dimmed">{t("analysis.locateStart")}</Text>
      ) : chain.length === 0 ? (
        <Text inherit c="dimmed">{t("analysis.noSource")}</Text>
      ) : (
        chain.map((h, i) => (
          <Box
            key={`${h.from}-${h.depth}`}
            component="button"
            type="button"
            onClick={() => onPick(h)}
            ff="monospace"
            fz={11.5}
            ta="left"
            p={0}
            bg="transparent"
            bd="none"
            c={current?.from === h.from && current.to === h.to ? "var(--accent)" : "inherit"}
            style={{ cursor: "pointer", fontWeight: i === 0 ? 700 : 400, paddingLeft: Math.min(i, 6) * 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            title={h.text}
          >
            {t("preview.line", { line: h.line })}: {h.text}
          </Box>
        ))
      )}
      {truncated && <Text inherit c="var(--warn)">{t("analysis.truncated")}</Text>}
    </Stack>
  );
}
