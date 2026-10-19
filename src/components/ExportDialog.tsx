import { useState } from "react";
import { Button, List, SimpleGrid, Text, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { EXPORT_FORMATS, type PrintLayout } from "../api";
import { EXPORT_PRESETS, presetById } from "../exportPresets";
import { getPref, setPref } from "../prefs";
import type { ExportFormat, FcProject } from "../types";
import { Dialog } from "./Dialog";
import { Check, Section } from "./form";

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

  const card = (on: boolean) => ({
    p: "10px 12px",
    bg: on ? "var(--accent-soft)" : "var(--surface-2)",
    bd: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
    style: { borderRadius: 6, textAlign: "left", display: "block", width: "100%" },
  }) as const;

  return (
    <Dialog
      title={t("export.title")}
      onClose={onClose}
      footer={
        <>
          <Text c="dimmed" flex={1}>
            {triangles ? `${name}.${f.ext} · ${triangles.toLocaleString()} ${t("preview.tris")} · ${size}` : t("export.noModel")}
          </Text>
          <Button variant="default" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!triangles} onClick={() => onExport(format, { ...pick, supports: canSupports && pick.supports })}>
            {t("export.action")}
          </Button>
        </>
      }
    >
      <Section first>{t("export.presetTitle")}</Section>
      <SimpleGrid cols={2} spacing={8} role="radiogroup" aria-label={t("export.presetTitle")}>
        {EXPORT_PRESETS.map((x) => (
          <UnstyledButton key={x.id} role="radio" aria-checked={presetId === x.id} {...card(presetId === x.id)} onClick={() => choosePreset(x.id)}>
            <Text fw={700} inherit>{t(`export.preset.${x.id}.name`)}</Text>
            <Text c="dimmed" inherit>{t(`export.preset.${x.id}.about`)}</Text>
          </UnstyledButton>
        ))}
        <UnstyledButton role="radio" aria-checked={!preset} {...card(!preset)} onClick={() => choosePreset("custom")}>
          <Text fw={700} inherit>{t("export.preset.custom.name")}</Text>
          <Text c="dimmed" inherit>{t("export.preset.custom.about")}</Text>
        </UnstyledButton>
      </SimpleGrid>
      {preset && (
        <>
          <List listStyleType="none" aria-label={t("export.preflight")} mt={10} mb={4} spacing={3} fz={13}>
            {checks.map((c) => (
              <List.Item key={c.key} c={c.ok === null ? "dimmed" : c.ok ? undefined : "var(--bad)"}>
                {c.ok === null ? "•" : c.ok ? <Text span inherit c="var(--ok)">✓</Text> : "!"} {t(`export.preset.${preset.id}.check.${c.key}.${c.ok === null ? "unknown" : c.ok ? "ok" : "warn"}`, c.values)}
              </List.Item>
            ))}
          </List>
          <List mt={6} fz={12.5} c="dimmed" pl={4}>
            {preset.hints.map((h) => (
              <List.Item key={h}>{t(`export.preset.${preset.id}.hint.${h}`)}</List.Item>
            ))}
          </List>
        </>
      )}

      <Section>{t("export.format")}</Section>
      <SimpleGrid cols={2} spacing={8} role="radiogroup" aria-label={t("export.format")}>
        {EXPORT_FORMATS.map((x) => (
          <UnstyledButton key={x.id} role="radio" aria-checked={format === x.id} {...card(format === x.id)} onClick={() => setFormat(x.id)}>
            <Text fw={700} inherit>{t(`export.fmt.${x.id}`)}</Text>
            <Text c="dimmed" inherit>{t(`export.fmtHint.${x.id}`)}</Text>
          </UnstyledButton>
        ))}
      </SimpleGrid>

      <Section>{t("export.options")}</Section>
      <Check
        disabled={!canSupports}
        checked={canSupports && pick.supports}
        onChange={(v) => setPick({ ...pick, supports: v })}
        label={
          <>
            {t("export.opt.supports")}
            {!canSupports && <Text span inherit c="dimmed"> {t("export.noSupports")}</Text>}
          </>
        }
      />
      <Check checked={pick.simplify} onChange={(v) => setPick({ ...pick, simplify: v })} label={<>{t("export.opt.simplify")} <Text span inherit c="dimmed">({project.settings.optimization.keepPercent}%)</Text></>} />
      <Check checked={pick.sprue} onChange={(v) => setPick({ ...pick, sprue: v })} label={t("export.opt.sprue")} />
      <Check checked={pick.hollow} onChange={(v) => setPick({ ...pick, hollow: v })} label={<>{t("export.opt.hollow")} <Text span inherit c="dimmed">({project.settings.printing.hollow.wall} mm)</Text></>} />
    </Dialog>
  );
}
