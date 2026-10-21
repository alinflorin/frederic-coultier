import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Indicator, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { inTauri } from "../api";
import { getPref, setPref } from "../prefs";
import { RHINO_DEFAULT_HOST, RHINO_DEFAULT_PORT, rhinoConfigure, rhinoStatus, type RhinoStatus } from "../rhino";
import { rhinoSchema } from "../validation";
import { TextField } from "./form";

const errorText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e));

/** Where the Rhino plugin listens, and whether the app can reach it. */
export function RhinoPrefs() {
  const { t } = useTranslation();
  const schema = useMemo(() => rhinoSchema(t), [t]);
  const form = useForm<{ host: string; port: string }>({
    defaultValues: { host: getPref<string>("rhinoHost") || RHINO_DEFAULT_HOST, port: String(getPref<number>("rhinoPort") || RHINO_DEFAULT_PORT) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    mode: "onTouched",
  });
  const { host, port } = useWatch({ control: form.control }) as { host: string; port: string };
  const [status, setStatus] = useState<RhinoStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!inTauri()) return;
    rhinoStatus(true).then(setStatus, (e) => setProblem(errorText(e)));
  }, []);

  if (!inTauri()) return <Text fz={12} c="dimmed" mt={6}>{t("prefs.rhino.desktopOnly")}</Text>;

  const valid = schema.safeParse({ host, port }).success;
  const changed = !status || status.host !== host.trim() || status.port !== Number(port.trim());

  const apply = form.handleSubmit(async (v) => {
    const h = v.host.trim();
    const p = Number(v.port.trim());
    setBusy(true);
    setProblem(null);
    setPref("rhinoHost", h);
    setPref("rhinoPort", p);
    try {
      setStatus(await rhinoConfigure(h, p));
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  });
  const recheck = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setStatus(await rhinoStatus(true));
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const dot = (color: string) => (
    <Indicator inline size={9} color={color} withBorder={false} offset={0} position="middle-center">
      <span style={{ display: "block", width: 9, height: 9 }} />
    </Indicator>
  );

  return (
    <>
      <Text fz={12} c="dimmed" mt={6}>{t("prefs.rhino.intro")}</Text>
      <TextField control={form.control} name="host" label={t("prefs.rhino.host")} />
      <TextField control={form.control} name="port" label={t("prefs.rhino.port")} />
      <Group gap={8} mt={8} mb={4}>
        <Button disabled={busy || !valid || !changed} onClick={apply}>
          {busy ? t("prefs.rhino.applying") : t("prefs.rhino.apply")}
        </Button>
        <Button type="button" variant="default" disabled={busy} onClick={recheck}>{t("prefs.rhino.check")}</Button>
        <Button
          type="button"
          variant="default"
          disabled={busy || (host === RHINO_DEFAULT_HOST && port === String(RHINO_DEFAULT_PORT))}
          onClick={() => form.reset({ host: RHINO_DEFAULT_HOST, port: String(RHINO_DEFAULT_PORT) })}
        >
          {t("prefs.rhino.defaults")}
        </Button>
      </Group>
      <Group gap={6} mt={10} mb={6} fz={13} role="status" wrap="wrap">
        {problem ? (
          <Text span inherit c="var(--bad)">{problem}</Text>
        ) : status?.connected ? (
          <>
            {dot("var(--ok)")} {t("rhino.connected", { host: status.host, port: status.port })}
            <Text span inherit c="dimmed">
              {status.document ?? t("rhino.untitled")} · {status.units ?? "?"} · {t("rhino.objects", { count: status.objects ?? 0 })}
            </Text>
            {status.unitMm !== 1 && <Text span inherit c="var(--accent)">{t("rhino.notMm")}</Text>}
          </>
        ) : status ? (
          <>
            {dot("var(--bad)")} {t("rhino.offTitle", { host: status.host, port: status.port })}
            {status.error && <Text span inherit c="var(--bad)"> {status.error}</Text>}
          </>
        ) : null}
      </Group>
      <Text fz={12} c="dimmed">{t("prefs.rhino.plugin")}</Text>
    </>
  );
}
