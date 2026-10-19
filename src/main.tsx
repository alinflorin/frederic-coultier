import { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { UiProvider } from "./mantine";
import { initI18n } from "./i18n";
import { loadPrefs } from "./prefs";
import { applyTheme, getTheme } from "./theme";

// Full-window app: the page itself never scrolls (panes scroll inside).
for (const el of [document.documentElement, document.body, document.getElementById("root")!]) {
  Object.assign(el.style, { height: "100%", margin: "0" });
}
document.body.style.overflow = "hidden";

// Preferences first: the theme and language below read from them.
loadPrefs()
  .catch((e) => console.warn("could not load preferences", e))
  .then(() => {
    applyTheme(getTheme());
    return initI18n();
  })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <UiProvider>
        <Suspense fallback={null}>
          <App />
        </Suspense>
      </UiProvider>,
    );
  });
