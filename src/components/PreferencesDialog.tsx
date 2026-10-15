import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, setLanguage, type Language } from "../i18n";
import { Dialog } from "./Dialog";

const LANGUAGE_NAMES: Record<Language, string> = { en: "English", ro: "Română" };

/** App-wide preferences, as opposed to the settings stored in a project. */
export function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <Dialog
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
    </Dialog>
  );
}
