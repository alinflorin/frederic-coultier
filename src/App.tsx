import { useState } from "react";
import { useTranslation } from "react-i18next";
import reactLogo from "./assets/react.svg";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { SUPPORTED_LANGUAGES, setLanguage, type Language } from "./i18n";
import "./App.css";

function App() {
  const { t, i18n } = useTranslation();
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [updateMsg, setUpdateMsg] = useState("");

  function greet() {
    setGreetMsg(t("greeting", { name }));
  }

  async function checkForUpdates() {
    const update = await check();
    if (!update) {
      setUpdateMsg(t("upToDate"));
      return;
    }
    setUpdateMsg(t("downloading", { version: update.version }));
    await update.downloadAndInstall();
    await relaunch();
  }

  return (
    <main className="container">
      <label className="row">
        {t("language")}:&nbsp;
        <select
          value={i18n.resolvedLanguage}
          onChange={(e) => setLanguage(e.currentTarget.value as Language)}
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>
      </label>

      <h1>{t("title")}</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>{t("logosHint")}</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder={t("namePlaceholder")}
        />
        <button type="submit">{t("greetButton")}</button>
      </form>
      <p>{greetMsg}</p>
      <button onClick={() => checkForUpdates().catch((e) => setUpdateMsg(String(e)))}>
        {t("checkUpdates")}
      </button>
      <p>{updateMsg}</p>
    </main>
  );
}

export default App;
