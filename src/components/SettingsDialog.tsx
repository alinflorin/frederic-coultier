import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ActionIcon, Button, Group, List, Slider, Table, Tabs, Text, Textarea } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import type { FcProject, Finish, Metal, ProjectSettings, Support, SupportsData } from "../types";
import { autoSupports, extraChecks, type PrintLayout, meshReport, printParams, suggestTilt, type MeshReport, type TiltRow } from "../api";
import { DENSITY } from "../materials";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { settingsSchema } from "../validation";
import { findingParams } from "../findings";
import { CheckField, ColorField, Enabled, Field, Num, NumField, Section, SelectField, Stat } from "./form";

type Tab = "general" | "material" | "printing" | "optimization" | "checks";
/** Each tab scrolls on its own, so the tab list stays put. */
const PANEL = { flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto", paddingRight: 4 } as const;
const TABS: Tab[] = ["general", "material", "printing", "optimization", "checks"];
const METALS: Metal[] = ["silver925", "gold18y", "gold18r", "gold18w", "platinum", "resin"];
const FINISHES: Finish[] = ["polished", "satin", "matte"];

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
  const compact = useMediaQuery("(max-width: 899px)");
  const [tab, setTab] = useState<Tab>("general");
  // The form holds the project settings. A message shows for a field once it was touched and left; every
  // valid change is applied to the project at once, a change that does not validate waits until it does.
  const schema = useMemo(() => settingsSchema(t), [t]);
  const form = useForm<ProjectSettings>({
    defaultValues: project.settings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    mode: "onTouched",
  });
  const s = useWatch({ control: form.control }) as ProjectSettings;
  const latest = useRef(project.settings);
  latest.current = project.settings;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const sub = form.watch((values) => {
      if (JSON.stringify(values) !== JSON.stringify(latest.current) && schema.safeParse(values).success) onChangeRef.current(values as ProjectSettings);
    });
    return () => sub.unsubscribe();
  }, [form, schema]);
  // the project changed from elsewhere (the agent, a click in the preview): show it
  useEffect(() => {
    if (JSON.stringify(form.getValues()) !== JSON.stringify(project.settings)) form.reset(project.settings, { keepTouched: true });
  }, [form, project.settings]);
  const set = (path: string, value: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.setValue(path as any, value as any, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
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
          tab === "checks" ? { minWall: s.printing.minWall, minGap: 0.3, casting: s.material.process === "casting" } : undefined,
          tab === "checks" ? extraChecks({ ...project, settings: s }) : undefined,
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
    set("printing.sprueAt", at);
  };
  const control = form.control;

  return (
    <Dialog
      wide
      fixed
      title={t("settings.title")}
      onClose={onClose}
      footer={
        <>
          <Text c="dimmed" flex={1}>{t("settings.autosave")}</Text>
          <Button onClick={onClose}>{t("common.done")}</Button>
        </>
      }
    >
      <Tabs value={tab} onChange={(v) => v && setTab(v as Tab)} orientation={compact ? "horizontal" : "vertical"} h="100%" keepMounted={false}>
        <Tabs.List mr={compact ? 0 : 18} mb={compact ? 10 : 0} w={compact ? undefined : 170} style={{ flex: "none", overflowX: compact ? "auto" : undefined, flexWrap: "nowrap" }}>
          {TABS.map((k) => (
            <Tabs.Tab key={k} value={k}>{t(`settings.tab.${k}`)}</Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="general" style={PANEL}>
          <Field label={t("settings.notes")}>
            <Controller control={control} name="general.notes" render={({ field }) => <Textarea rows={4} flex={1} {...field} value={field.value ?? ""} />} />
          </Field>
        </Tabs.Panel>

        <Tabs.Panel value="material" style={PANEL}>
          <Section first>{t("settings.materialTitle")}</Section>
          <SelectField control={control} name="material.metal" label={t("settings.metal")} hint={t("settings.metalHint")} data={METALS.map((m) => ({ value: m, label: t(`metal.${m}`) }))} />
          <SelectField control={control} name="material.process" label={t("settings.process")} data={[
            { value: "casting", label: t("settings.casting") },
            { value: "direct", label: t("settings.direct") },
          ]} />
          <Section>{t("settings.renderTitle")}</Section>
          <ColorField control={control} name="render.metalColor" label={t("settings.metalColor")} />
          <SelectField control={control} name="render.finish" label={t("settings.finish")} data={FINISHES.map((f) => ({ value: f, label: t(`finish.${f}`) }))} />
          <NumField control={control} name="render.previewQuality" label={t("settings.previewQuality")} hint={t("settings.previewQualityHint")} step={4} unit="$fn" />
        </Tabs.Panel>

        <Tabs.Panel value="printing" style={PANEL}>
          <SelectField control={control} name="printing.printer" label={t("settings.printer")} data={[{ value: "Elegoo Mars 5", label: "Elegoo Mars 5" }]} />
          <NumField control={control} name="printing.minWall" label={t("settings.minWall")} hint={t("settings.minWallHint")} unit="mm" />
          <NumField control={control} name="printing.tilt" label={t("settings.tilt")} hint={t("settings.tiltHint")} step={5} unit="°" />

          <Section>{t("settings.supportsTitle")}</Section>
          <CheckField control={control} name="printing.supports.enabled" label={t("settings.supportsEnable")} />
          <Enabled on={sup.enabled}>
            <NumField control={control} name="printing.supports.tipRadius" label={t("settings.tipRadius")} step={0.05} unit="mm" />
            <NumField control={control} name="printing.supports.baseRadius" label={t("settings.baseRadius")} unit="mm" />
            <NumField control={control} name="printing.supports.overhangAngle" label={t("settings.overhang")} step={5} unit="°" />
            <NumField control={control} name="printing.supports.spacing" label={t("settings.spacing")} step={0.5} unit="mm" />
            <NumField control={control} name="printing.supports.raftRadius" label={t("settings.raft")} step={0.5} unit="mm" />
            <NumField control={control} name="printing.supports.raftThickness" label={t("settings.raftThickness")} hint={t("settings.raftThicknessHint")} unit="mm" />
            <NumField control={control} name="printing.supports.lift" label={t("settings.lift")} hint={t("settings.liftHint")} step={0.5} unit="mm" />
            <Group gap={6} mt={8} wrap="wrap">
              <Text c="dimmed" flex={1}>{t("settings.supportCount", { count: list.length, auto: nAuto, manual: nManual })}</Text>
              <Button variant="default" size="xs" disabled={working !== null} onClick={runTilt}>{working === "tilt" ? "…" : t("settings.suggestTilt")}</Button>
              <Button variant="default" size="xs" disabled={working !== null} onClick={runAuto}>{working === "auto" ? "…" : t("settings.autoSupports")}</Button>
              <Button variant="default" size="xs" disabled={working !== null || nAuto === 0} onClick={() => onSupports({ ...project.supports, list: list.filter((x) => x.source === "manual") })}>
                {t("settings.clearSupports")}
              </Button>
            </Group>
            {note && <Text c="dimmed" role="status" mt={6}>{note}</Text>}
            <Group gap={6} mt={8}>
              <Text component="h4" fw={600} flex={1}>{t("settings.supportList")}</Text>
              <Button variant="default" size="xs" onClick={addSupport}>{t("settings.addSupport")}</Button>
            </Group>
            {list.length > 0 && (
              <Table mt={6} fz={12} withRowBorders={false}>
                <Table.Thead>
                  <Table.Tr><Table.Th>#</Table.Th><Table.Th>X</Table.Th><Table.Th>Y</Table.Th><Table.Th>Z</Table.Th><Table.Th /></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {list.map((sp) => (
                    <Table.Tr key={sp.id}>
                      <Table.Td c="dimmed" title={t(`settings.source.${sp.source}`)}>{sp.id}{sp.source === "manual" ? "*" : ""}</Table.Td>
                      {(["x", "y", "z"] as const).map((k) => (
                        <Table.Td key={k}>
                          <Num w={80} value={Number(sp[k].toFixed(2))} onChange={(v) => setSupport(sp.id, { [k]: v })} />
                        </Table.Td>
                      ))}
                      <Table.Td>
                        <ActionIcon variant="subtle" color="gray" onClick={() => removeSupport(sp.id)} title={t("settings.removeSupport")} aria-label={t("settings.removeSupport")}>
                          <Icon name="close" size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
            {rows && (
              <Table mt={8} fz={12.5}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t("settings.tiltCol")}</Table.Th>
                    <Table.Th>{t("settings.overhangCol")}</Table.Th>
                    <Table.Th>{t("settings.flatCol")}</Table.Th>
                    <Table.Th>{t("settings.sizeCol")}</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((r, i) => (
                    <Table.Tr key={r.tilt}>
                      <Table.Td c={i === 0 ? "var(--ok)" : undefined} fw={i === 0 ? 600 : undefined}>{r.tilt}°</Table.Td>
                      <Table.Td>{r.overhang.toFixed(1)}</Table.Td>
                      <Table.Td>{r.flat.toFixed(1)}</Table.Td>
                      <Table.Td>{r.fits ? r.size.map((n) => n.toFixed(0)).join(" × ") : t("settings.noFit")}</Table.Td>
                      <Table.Td><Button variant="default" size="compact-xs" disabled={s.printing.tilt === r.tilt} onClick={() => set("printing.tilt", r.tilt)}>{t("settings.useTilt")}</Button></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Enabled>

          <Section>{t("settings.hollowTitle")}</Section>
          <CheckField control={control} name="printing.hollow.enabled" label={t("settings.hollowEnable")} />
          <Enabled on={s.printing.hollow.enabled}>
            <NumField control={control} name="printing.hollow.wall" label={t("settings.hollowWall")} unit="mm" />
            <NumField control={control} name="printing.hollow.drain" label={t("settings.drain")} unit="mm" />
          </Enabled>
          <CheckField control={control} name="printing.sprue" label={t("settings.sprue")} />
          <Enabled on={s.printing.sprue}>
            <NumField control={control} name="printing.sprueDiameter" label={t("settings.sprueDiameter")} unit="mm" />
            <NumField control={control} name="printing.sprueLength" label={t("settings.sprueLength")} step={0.5} unit="mm" />
            <Field label={t("settings.spruePos")} hint={s.printing.sprueAt ? t("settings.sprueManual") : t("settings.sprueAuto")}>
              {([0, 1, 2] as const).map((i) => (
                <Num key={i} w={78} disabled={!spruePos} value={spruePos ? Number(spruePos[i].toFixed(2)) : 0} onChange={(v) => typeof v === "number" && setSpruePos(i, v)} />
              ))}
              <Button variant="default" size="xs" disabled={!s.printing.sprueAt} onClick={() => set("printing.sprueAt", null)}>{t("settings.sprueReset")}</Button>
            </Field>
          </Enabled>
        </Tabs.Panel>

        <Tabs.Panel value="optimization" style={PANEL}>
          <Text c="dimmed" mb={6}>{t("settings.optimizeIntro")}</Text>
          <CheckField control={control} name="optimization.simplify" label={t("settings.simplify")} />
          <Enabled on={s.optimization.simplify}>
            <Field label={t("settings.keep")} hint={t("settings.keepHint")}>
              <Controller control={control} name="optimization.keepPercent" render={({ field }) => (
                <>
                  <Slider w={{ base: "100%", md: 180 }} size="sm" label={null} min={1} max={99} value={Number(field.value)} onChange={field.onChange} />
                  <Text fw={700}>{field.value}%</Text>
                </>
              )} />
            </Field>
            <NumField control={control} name="optimization.maxVolumeChange" label={t("settings.maxVolume")} hint={t("settings.maxVolumeHint")} unit="%" />
          </Enabled>
          <Button variant="default" size="xs" mt={8} disabled={analyzing} onClick={analyze}>{analyzing ? "…" : t("settings.analyze")}</Button>
          {reportError && <Text c="var(--bad)" role="alert" mt={6}>{reportError}</Text>}
          {report && (
            <Group gap={14} mt={16} align="stretch" wrap="nowrap">
              <Stat label={t("settings.trisNow")} value={report.stats.triangles.toLocaleString()} />
              {report.simplify && (
                <Stat
                  label={t("settings.trisAfter")}
                  value={report.simplify.accepted ? report.simplify.after.toLocaleString() : "—"}
                  sub={report.simplify.accepted ? t("settings.volumeChange", { pct: report.simplify.volumeChange.toFixed(3) }) : t(`settings.rejected.${report.simplify.reason}`)}
                />
              )}
            </Group>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="checks" style={PANEL}>
          <Text c="dimmed" mb={6}>{t("settings.checksIntro")}</Text>
          <Button variant="default" size="xs" disabled={analyzing} onClick={analyze}>{analyzing ? "…" : t("settings.analyze")}</Button>
          {reportError && <Text c="var(--bad)" role="alert" mt={6}>{reportError}</Text>}
          {report && (
            <>
              <List listStyleType="none" my={8} spacing={4} fz={13}>
                {report.findings.map((f, i) => (
                  <List.Item key={i}>
                    <Text span inherit fw={700} c={f.level === "pass" ? "var(--ok)" : f.level === "fail" ? "var(--bad)" : f.level === "warn" ? "var(--warn)" : "dimmed"}>
                      {t(`findings.level.${f.level}`)}
                    </Text>{" "}
                    {t(`findings.${f.code}`, findingParams(f.detail))}
                    {f.at && f.at.length > 0 && (
                      <Text span c="dimmed" fz={11.5}>
                        {" "}
                        {f.at.map((p) => `(${p.map((n) => n.toFixed(1)).join(", ")})`).join(" ")}
                      </Text>
                    )}
                  </List.Item>
                ))}
              </List>
              <Section>{t("settings.measure")}</Section>
              <Group gap={14} align="stretch" wrap="nowrap">
                <Stat label={t("preview.volume")} value={`${(report.stats.volume / 1000).toFixed(3)} cm³`} />
                <Stat label={t("settings.surface")} value={`${report.stats.area.toFixed(1)} mm²`} />
                <Stat label={`${t("preview.weight")} (${t(`metal.${s.material.metal}`)})`} value={`${((report.stats.volume / 1000) * DENSITY[s.material.metal]).toFixed(2)} g`} />
              </Group>
            </>
          )}
        </Tabs.Panel>
      </Tabs>
    </Dialog>
  );
}
