import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, NativeSelect, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, setLanguage, type Language } from "../i18n";
import { THEMES, getTheme, setTheme, type Theme } from "../theme";
import type { EngineInfo, ModelInfo } from "../chat/engines";
import { getPref, setPref } from "../prefs";
import { playChime, setChimeOn, setChimeSecs, useChime } from "../chime";
import { Dialog } from "./Dialog";
import { RhinoPrefs } from "./RhinoPrefs";
import { chimeSchema } from "../validation";
import { Check, Field, Note, NumField, Section } from "./form";

/** App-wide preferences, as opposed to the settings stored in a project. */
export function PreferencesDialog({
  autoUpdate,
  autoUpdateAvailable,
  followRhino,
  onFollowRhino,
  onAutoUpdate,
  engines,
  engine,
  onEngine,
  models,
  model,
  efforts,
  effort,
  onModel,
  onEffort,
  onRefreshEngines,
  onClose,
}: {
  autoUpdate: boolean;
  /** False when a package manager owns the installation. */
  autoUpdateAvailable: boolean;
  /** Show what the user changes in Rhino within a second. */
  followRhino: boolean;
  onFollowRhino: (on: boolean) => void;
  onAutoUpdate: (on: boolean) => void;
  /** The agents that could answer in the chat; null until they have been looked up. */
  engines: EngineInfo[] | null;
  engine: string | null;
  onEngine: (id: string) => void;
  /** Defaults of the chosen agent; empty means the agent's own choice. */
  models: ModelInfo[];
  model: string;
  efforts: string[];
  effort: string;
  onModel: (id: string) => void;
  onEffort: (level: string) => void;
  onRefreshEngines: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [allTools, setAllTools] = useState(() => getPref<boolean>("chatAllTools") === true);
  // someone may have signed in since the app started
  useEffect(() => {
    onRefreshEngines();
  }, [onRefreshEngines]);
  const chime = useChime();
  // the minimum time for a chime: a message shows once the field was touched and left, a valid number applies at once
  const chimeRules = useMemo(() => chimeSchema(t), [t]);
  const chimeForm = useForm<{ secs: number | string }>({
    defaultValues: { secs: chime.secs },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(chimeRules) as any,
    mode: "onTouched",
  });
  useEffect(() => {
    const sub = chimeForm.watch((v) => {
      const r = chimeRules.safeParse(v);
      if (r.success) setChimeSecs(r.data.secs);
    });
    return () => sub.unsubscribe();
  }, [chimeForm, chimeRules]);
  const usable = engines?.some((e) => e.available) ?? false;
  return (
    <Dialog
      wide
      title={t("prefs.title")}
      onClose={onClose}
      footer={
        <>
          <Text c="dimmed" flex={1}>{t("prefs.hint")}</Text>
          <Button onClick={onClose}>{t("common.done")}</Button>
        </>
      }
    >
      <Field label={t("language")}>
        <NativeSelect
          size="xs"
          value={i18n.resolvedLanguage}
          data={SUPPORTED_LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))}
          onChange={(e) => setLanguage(e.currentTarget.value as Language)}
        />
      </Field>
      <Field label={t("prefs.theme")}>
        <NativeSelect
          size="xs"
          value={theme}
          data={THEMES.map((th) => ({ value: th, label: t(`prefs.themes.${th}`) }))}
          onChange={(e) => {
            const next = e.currentTarget.value as Theme;
            setThemeState(next);
            setTheme(next);
          }}
        />
      </Field>
      <Field label={t("prefs.autoUpdate")}>
        <Check checked={autoUpdate} disabled={!autoUpdateAvailable} onChange={onAutoUpdate} label="" />
      </Field>
      {!autoUpdateAvailable && <Note>{t("prefs.autoUpdateManaged")}</Note>}

      <Section>{t("prefs.chat.title")}</Section>
      <Field label={t("prefs.chat.allTools")}>
        <Check
          checked={allTools}
          onChange={(on) => {
            setPref("chatAllTools", on);
            setAllTools(on);
          }}
          label=""
        />
      </Field>
      <Note>{t("prefs.chat.allToolsHint")}</Note>
      <Field label={t("prefs.chat.chime")}>
        <Check checked={chime.on} onChange={setChimeOn} label="" />
        <Button type="button" variant="default" size="xs" onClick={playChime}>{t("prefs.chat.chimePlay")}</Button>
      </Field>
      <NumField control={chimeForm.control} name="secs" label={t("prefs.chat.chimeAfter")} step={5} disabled={!chime.on} />
      <Note>{t("prefs.chat.chimeHint")}</Note>
      <Field label={t("prefs.chat.agent")}>
        <NativeSelect
          size="xs"
          value={engine ?? ""}
          disabled={!usable}
          data={(engines ?? []).map((e) => ({ value: e.id, label: `${e.label} — ${e.available ? e.detail : t("prefs.chat.unavailable")}`, disabled: !e.available }))}
          onChange={(e) => onEngine(e.currentTarget.value)}
        />
        <Button type="button" variant="default" size="xs" onClick={onRefreshEngines}>{t("prefs.chat.refresh")}</Button>
      </Field>
      {usable && (
        <>
          <Field label={t("prefs.chat.model")}>
            <NativeSelect size="xs" value={model} data={[{ value: "", label: t("prefs.chat.own") }, ...models.map((m) => ({ value: m.id, label: m.label }))]} onChange={(e) => onModel(e.currentTarget.value)} />
          </Field>
          {efforts.length > 0 && (
            <Field label={t("prefs.chat.effort")}>
              <NativeSelect size="xs" value={effort} data={[{ value: "", label: t("prefs.chat.own") }, ...efforts.map((l) => ({ value: l, label: l }))]} onChange={(e) => onEffort(e.currentTarget.value)} />
            </Field>
          )}
        </>
      )}
      {engines && !usable && <Note>{t("prefs.chat.none")}</Note>}
      {engines?.filter((e) => !e.available).map((e) => (
        <Note key={e.id}>{e.label}: {e.detail}</Note>
      ))}
      <Note>{t("prefs.chat.hint")}</Note>

      <Section>{t("prefs.rhino.title")}</Section>
      <Field label={t("prefs.rhino.follow")}>
        <Check checked={followRhino} onChange={onFollowRhino} label="" />
      </Field>
      <Note>{t("prefs.rhino.followHint")}</Note>
      <RhinoPrefs />
    </Dialog>
  );
}
