import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, setLanguage, type Language } from "../i18n";
import { THEMES, getTheme, setTheme, type Theme } from "../theme";
import { Icon } from "./Icon";

export type RunMode = "chat" | "mcp";

/** First-run walkthrough: what the app is, then how the user wants to drive it. */
export function Onboarding({
  chatAvailable,
  onRefresh,
  onDone,
}: {
  /** False once we know neither Claude Code nor Codex is signed in; null while still looking. */
  chatAvailable: boolean | null;
  /** Looks for signed-in agents again, after the user followed the sign-in steps. */
  onRefresh: () => void;
  onDone: (mode: RunMode, allTools: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [mode, setMode] = useState<RunMode>("chat");
  const [allTools, setAllTools] = useState(false);
  const chatBlocked = chatAvailable === false;
  const chosen: RunMode = chatBlocked ? "mcp" : mode;

  return (
    <div className="backdrop onboarding" role="dialog" aria-modal="true" aria-label={t("onboarding.title")}>
      <div className="dialog onboarding-card">
        {step === 0 ? (
          <div className="dialog-body">
            <h2 className="onboarding-q">{t("onboarding.lookTitle")}</h2>
            <h3>{t("language")}</h3>
            <div className="choice-row" role="radiogroup" aria-label={t("language")}>
              {SUPPORTED_LANGUAGES.map((l: Language) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={i18n.resolvedLanguage === l}
                  className={i18n.resolvedLanguage === l ? "on" : ""}
                  onClick={() => setLanguage(l)}
                >
                  {LANGUAGE_NAMES[l]}
                </button>
              ))}
            </div>
            <h3>{t("prefs.theme")}</h3>
            <div className="choice-row" role="radiogroup" aria-label={t("prefs.theme")}>
              {THEMES.map((th) => (
                <button
                  key={th}
                  type="button"
                  role="radio"
                  aria-checked={theme === th}
                  className={theme === th ? "on" : ""}
                  onClick={() => {
                    setThemeState(th);
                    setTheme(th);
                  }}
                >
                  {t(`prefs.themes.${th}`)}
                </button>
              ))}
            </div>
          </div>
        ) : step === 1 ? (
          <div className="dialog-body onboarding-body">
            <img src="/logo.svg" width={64} height={64} alt="" />
            <h1>{t("onboarding.title")}</h1>
            <p>{t("onboarding.about1")}</p>
            <p className="muted">{t("onboarding.about2")}</p>
          </div>
        ) : (
          <div className="dialog-body">
            <h2 className="onboarding-q">{t("onboarding.modeTitle")}</h2>
            <p className="muted note">{t("onboarding.modeHint")}</p>
            <div className="mode-cards" role="radiogroup">
              {(["chat", "mcp"] as const).map((id) => {
                const disabled = id === "chat" && chatBlocked;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={chosen === id}
                    disabled={disabled}
                    className={`mode-card${chosen === id ? " on" : ""}`}
                    onClick={() => setMode(id)}
                  >
                    <span className="mode-head">
                      <Icon name={id === "chat" ? "chat" : "code"} size={20} />
                      <b>{t(`onboarding.${id}.name`)}</b>
                      {id === "chat" && <span className="mode-tag">{t("onboarding.recommended")}</span>}
                    </span>
                    <span>{t(`onboarding.${id}.what`)}</span>
                    <span className="muted">{t(`onboarding.${id}.how`)}</span>
                    {disabled && <span className="mcp-warn">{t("chat.noAgent")}</span>}
                  </button>
                );
              })}
            </div>
            {chatBlocked && (
              <div className="onboarding-signin">
                <b>{t("onboarding.signin.title")}</b>
                <ol>
                  <li>{t("onboarding.signin.step1")}</li>
                  <li>
                    <code>claude auth login</code> {t("onboarding.signin.or")} <code>codex login</code>
                  </li>
                  <li>{t("onboarding.signin.step3")}</li>
                </ol>
                <button type="button" onClick={onRefresh}>{t("onboarding.signin.check")}</button>
              </div>
            )}
            {chosen === "chat" && !chatBlocked && (
              <>
                <label className="field">
                  <span className="field-label">{t("prefs.chat.allTools")}</span>
                  <span className="field-input">
                    <input type="checkbox" checked={allTools} onChange={(e) => setAllTools(e.currentTarget.checked)} />
                  </span>
                </label>
                <p className="muted note">{t("prefs.chat.allToolsHint")}</p>
              </>
            )}
            <p className="muted note">{t("onboarding.later")}</p>
          </div>
        )}
        <footer className="dialog-foot onboarding-foot">
          <span className="onboarding-dots" aria-hidden>
            {[0, 1, 2].map((i) => (
              <i key={i} className={step === i ? "on" : ""} />
            ))}
          </span>
          {step > 0 && <button onClick={() => setStep((step - 1) as 0 | 1)}>{t("onboarding.back")}</button>}
          {step < 2 ? (
            <button className="primary" onClick={() => setStep((step + 1) as 1 | 2)}>{t("onboarding.next")}</button>
          ) : (
            <button className="primary" onClick={() => onDone(chosen, chosen === "chat" && allTools)}>{t("onboarding.start")}</button>
          )}
        </footer>
      </div>
    </div>
  );
}
