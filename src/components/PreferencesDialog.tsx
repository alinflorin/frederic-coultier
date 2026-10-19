import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, setLanguage, type Language } from "../i18n";
import { THEMES, getTheme, setTheme, type Theme } from "../theme";
import type { EngineInfo, ModelInfo } from "../chat/engines";
import { getPref, setPref } from "../prefs";
import { playChime, setChimeOn, setChimeSecs, useChime } from "../chime";
import { Dialog } from "./Dialog";
import { McpPrefs } from "./McpPrefs";

/** App-wide preferences, as opposed to the settings stored in a project. */
export function PreferencesDialog({
  autoUpdate,
  autoUpdateAvailable,
  onAutoUpdate,
  chatEnabled,
  onChatEnabled,
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
  onAutoUpdate: (on: boolean) => void;
  chatEnabled: boolean;
  onChatEnabled: (on: boolean) => void;
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
  const usable = engines?.some((e) => e.available) ?? false;
  return (
    <Dialog
      wide
      title={t("prefs.title")}
      onClose={onClose}
      footer={
        <>
          <span className="muted grow">{t("prefs.hint")}</span>
          <button className="primary" onClick={onClose}>{t("common.done")}</button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">{t("language")}</span>
        <span className="field-input">
          <select value={i18n.resolvedLanguage} onChange={(e) => setLanguage(e.currentTarget.value as Language)}>
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l} value={l}>{LANGUAGE_NAMES[l]}</option>
            ))}
          </select>
        </span>
      </label>
      <label className="field">
        <span className="field-label">{t("prefs.theme")}</span>
        <span className="field-input">
          <select
            value={theme}
            onChange={(e) => {
              const next = e.currentTarget.value as Theme;
              setThemeState(next);
              setTheme(next);
            }}
          >
            {THEMES.map((th) => (
              <option key={th} value={th}>{t(`prefs.themes.${th}`)}</option>
            ))}
          </select>
        </span>
      </label>

      <label className="field">
        <span className="field-label">{t("prefs.autoUpdate")}</span>
        <span className="field-input">
          <input type="checkbox" checked={autoUpdate} disabled={!autoUpdateAvailable} onChange={(e) => onAutoUpdate(e.currentTarget.checked)} />
        </span>
      </label>
      {!autoUpdateAvailable && <p className="muted">{t("prefs.autoUpdateManaged")}</p>}

      <h3>{t("prefs.chat.title")}</h3>
      <label className="field">
        <span className="field-label">{t("prefs.chat.enabled")}</span>
        <span className="field-input">
          <input
            type="checkbox"
            checked={chatEnabled}
            disabled={!chatEnabled && !usable}
            onChange={(e) => onChatEnabled(e.currentTarget.checked)}
          />
        </span>
      </label>
      <label className="field">
        <span className="field-label">{t("prefs.chat.allTools")}</span>
        <span className="field-input">
          <input
            type="checkbox"
            checked={allTools}
            onChange={(e) => {
              setPref("chatAllTools", e.currentTarget.checked);
              setAllTools(e.currentTarget.checked);
            }}
          />
        </span>
      </label>
      <p className="muted">{t("prefs.chat.allToolsHint")}</p>
      <label className="field">
        <span className="field-label">{t("prefs.chat.chime")}</span>
        <span className="field-input">
          <input type="checkbox" checked={chime.on} onChange={(e) => setChimeOn(e.currentTarget.checked)} />
          <button type="button" onClick={playChime}>{t("prefs.chat.chimePlay")}</button>
        </span>
      </label>
      <label className="field">
        <span className="field-label">{t("prefs.chat.chimeAfter")}</span>
        <span className="field-input">
          <input
            type="number"
            min={0}
            step={5}
            value={chime.secs}
            disabled={!chime.on}
            onChange={(e) => Number.isFinite(e.currentTarget.valueAsNumber) && setChimeSecs(e.currentTarget.valueAsNumber)}
          />
        </span>
      </label>
      <p className="muted">{t("prefs.chat.chimeHint")}</p>
      <label className="field">
        <span className="field-label">{t("prefs.chat.agent")}</span>
        <span className="field-input">
          <select value={engine ?? ""} disabled={!usable} onChange={(e) => onEngine(e.currentTarget.value)}>
            {(engines ?? []).map((e) => (
              <option key={e.id} value={e.id} disabled={!e.available}>
                {e.label} — {e.available ? e.detail : t("prefs.chat.unavailable")}
              </option>
            ))}
          </select>
          <button type="button" onClick={onRefreshEngines}>{t("prefs.chat.refresh")}</button>
        </span>
      </label>
      {usable && (
        <>
          <label className="field">
            <span className="field-label">{t("prefs.chat.model")}</span>
            <span className="field-input">
              <select value={model} onChange={(e) => onModel(e.currentTarget.value)}>
                <option value="">{t("prefs.chat.own")}</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </span>
          </label>
          {efforts.length > 0 && (
            <label className="field">
              <span className="field-label">{t("prefs.chat.effort")}</span>
              <span className="field-input">
                <select value={effort} onChange={(e) => onEffort(e.currentTarget.value)}>
                  <option value="">{t("prefs.chat.own")}</option>
                  {efforts.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </span>
            </label>
          )}
        </>
      )}
      {engines && !usable && <p className="muted">{t("prefs.chat.none")}</p>}
      {engines?.filter((e) => !e.available).map((e) => (
        <p key={e.id} className="muted">{e.label}: {e.detail}</p>
      ))}
      <p className="muted">{t("prefs.chat.hint")}</p>

      <h3>{t("prefs.mcp.title")}</h3>
      <McpPrefs />
    </Dialog>
  );
}
