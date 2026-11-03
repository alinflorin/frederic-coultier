import { useState } from "react";
import { ActionIcon, Button, Group, NativeSelect, Paper, SegmentedControl, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { AssetInfo } from "../api";
import { defaultCut, importSource, type Axis, type Cut } from "../importScad";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { Note, Num, Section } from "./form";

const AXES: Axis[] = ["x", "y", "z"];

/** After an STL has been imported: choose which sections to remove, then add it to the model. */
export function ImportDialog({
  asset,
  onInsert,
  onClose,
}: {
  asset: AssetInfo;
  /** Gets the OpenSCAD to append to the model. */
  onInsert: (scad: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [cuts, setCuts] = useState<Cut[]>([]);
  const patch = (i: number, c: Cut) => setCuts((all) => all.map((x, j) => (j === i ? c : x)));
  const size = asset.bounds ? asset.bounds[1].map((v, k) => v - asset.bounds![0][k]) : null;
  const num = (v: number | string, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

  return (
    <Dialog
      title={t("import.title", { name: asset.name })}
      onClose={onClose}
      footer={
        <>
          <span style={{ flex: 1 }} />
          <Button variant="default" onClick={onClose}>{t("common.cancel")}</Button>
          <Button autoFocus onClick={() => onInsert(importSource(asset, cuts))}>{t("import.insert")}</Button>
        </>
      }
    >
      <Text>
        {t("import.summary", { triangles: asset.triangles.toLocaleString() })}
        {size && ` · ${size.map((v) => v.toFixed(1)).join(" × ")}`}
      </Text>
      <Note>{t("import.units")}</Note>

      <Section>{t("import.cuts")}</Section>
      <Stack gap="xs">
        {cuts.length === 0 && <Note>{t("import.noCuts")}</Note>}
        {cuts.map((cut, i) => (
          <Paper key={i} withBorder p="xs">
            <Group justify="space-between" mb={6} wrap="nowrap">
              <Text fw={600}>{cut.kind === "half" ? t("import.half") : t("import.box")}</Text>
              <ActionIcon variant="subtle" color="gray" aria-label={t("import.removeCut")} onClick={() => setCuts((all) => all.filter((_, j) => j !== i))}>
                <Icon name="close" size={14} />
              </ActionIcon>
            </Group>
            {cut.kind === "half" ? (
              <Group gap="sm" align="center">
                <NativeSelect
                  size="xs"
                  aria-label={t("import.side")}
                  value={cut.remove}
                  data={[{ value: "above", label: t("import.above") }, { value: "below", label: t("import.below") }]}
                  onChange={(e) => patch(i, { ...cut, remove: e.currentTarget.value as "above" | "below" })}
                />
                <SegmentedControl size="xs" aria-label={t("import.axis")} value={cut.axis} data={AXES.map((a) => ({ value: a, label: a.toUpperCase() }))} onChange={(a) => patch(i, { ...cut, axis: a as Axis })} />
                <Num value={cut.at} w={100} onChange={(v) => patch(i, { ...cut, at: num(v, cut.at) })} />
              </Group>
            ) : (
              <Stack gap={4}>
                {AXES.map((a, k) => (
                  <Group key={a} gap="sm">
                    <Text w={16} fw={600}>{a.toUpperCase()}</Text>
                    <Num value={cut.min[k]} w={90} onChange={(v) => patch(i, { ...cut, min: cut.min.map((x, j) => (j === k ? num(v, x) : x)) as [number, number, number] })} />
                    <Text c="dimmed">{t("import.to")}</Text>
                    <Num value={cut.max[k]} w={90} onChange={(v) => patch(i, { ...cut, max: cut.max.map((x, j) => (j === k ? num(v, x) : x)) as [number, number, number] })} />
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>
        ))}
        <Group gap="xs">
          <Button size="xs" variant="default" leftSection={<Icon name="plus" size={14} />} onClick={() => setCuts((c) => [...c, defaultCut(asset, "half")])}>
            {t("import.addHalf")}
          </Button>
          <Button size="xs" variant="default" leftSection={<Icon name="plus" size={14} />} onClick={() => setCuts((c) => [...c, defaultCut(asset, "box")])}>
            {t("import.addBox")}
          </Button>
        </Group>
        <Note>{t("import.tune")}</Note>
      </Stack>
    </Dialog>
  );
}
