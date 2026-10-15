import { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n";
import { applyTheme, getTheme } from "./theme";

applyTheme(getTheme());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <Suspense fallback={null}>
    <App />
  </Suspense>,
);
