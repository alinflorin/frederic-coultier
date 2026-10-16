import { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initI18n } from "./i18n";
import { loadPrefs } from "./prefs";
import { applyTheme, getTheme } from "./theme";

// Preferences first: the theme and language below read from them.
loadPrefs()
  .catch((e) => console.warn("could not load preferences", e))
  .then(() => {
    applyTheme(getTheme());
    return initI18n();
  })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <Suspense fallback={null}>
        <App />
      </Suspense>,
    );
  });
