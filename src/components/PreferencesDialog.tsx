import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, setLanguage, type Language } from "../i18n";
import { THEMES, getTheme, setTheme, type Theme } from "../theme";
import { Dialog } from "./Dialog";
import { McpPrefs } from "./McpPrefs";

const LANGUAGE_NAMES: Record<Language, string> = { en: "English", ro: "Română" };

/** App-wide preferences, as opposed to the settings stored in a project. */
export function PreferencesDialog({ chatEnabled, onChatEnabled, onClose }: { chatEnabled: boolean; onChatEnabled: (on: boolean) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [theme, setThemeState] = useState<Theme>(getTheme);
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

      <h3>{t("prefs.chat.title")}</h3>
      <label className="field">
        <span className="field-label">{t("prefs.chat.enabled")}</span>
        <span className="field-input">
          <input type="checkbox" checked={chatEnabled} onChange={(e) => onChatEnabled(e.currentTarget.checked)} />
        </span>
      </label>
      <p className="muted">{t("prefs.chat.hint")}</p>

      <h3>{t("prefs.mcp.title")}</h3>
      <McpPrefs />
    </Dialog>
  );
}
