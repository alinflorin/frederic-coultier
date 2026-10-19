import { useSyncExternalStore, type ReactNode } from "react";
import {
  MantineProvider,
  createTheme,
  Menu,
  Modal,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";
import "@fontsource-variable/inter";
import "@mantine/core/styles.css";
import { getTheme, subscribeTheme } from "./theme";

// The brand gold: shade 6 is the light-mode accent, shade 4 the dark-mode one.
const gold: MantineColorsTuple = [
  "#fbf4e4", "#f2e2bf", "#e8cf98", "#ddb96f", "#d4a24c",
  "#a97a2c", "#8a6120", "#6f4e1a", "#563c14", "#3d2a0e",
];

const theme = createTheme({
  primaryColor: "gold",
  primaryShade: { light: 6, dark: 4 },
  colors: { gold },
  autoContrast: true,
  fontFamily: '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  fontSizes: { xs: "11px", sm: "12px", md: "14px", lg: "16px", xl: "18px" },
  defaultRadius: "md",
  cursorType: "pointer",
  components: {
    Modal: Modal.extend({ styles: { content: { background: "var(--surface)" }, header: { background: "var(--surface)" } } }),
    Menu: Menu.extend({ styles: { dropdown: { background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" } } }),
  },
  breakpoints: { xs: "36em", sm: "48em", md: "56.25em", lg: "74em", xl: "90em" },
  fontFamilyMonospace: 'ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace',
});

// The app's palette. Mantine writes these as CSS variables on :root for the active colour scheme,
// so components (and the 3D viewer and the code editor) read them as var(--surface), var(--accent)...
const LIGHT = {
  "--bg": "#f4f3f1",
  "--surface": "#ffffff",
  "--surface-2": "#eceae7",
  "--border": "#d9d6d1",
  "--text": "#1c1b1a",
  "--muted": "#6a665f",
  "--accent": "#8a6120",
  "--accent-text": "#ffffff",
  "--accent-soft": "rgba(138, 97, 32, 0.14)",
  "--ok": "#2d8a55",
  "--bad": "#c0392b",
  "--warn": "#c27a00",
  "--vp-bg": "radial-gradient(ellipse at 50% 35%, #ffffff 0%, #dedbd6 100%)",
  "--code-bg": "#faf9f7",
  "--tok-kw": "#9a3f8b",
  "--tok-num": "#1f6fb2",
  "--tok-var": "#b05a1c",
  "--tok-com": "#8a8780",
  "--tok-fn": "#1a7f7a",
  "--tok-str": "#2f7d32",
  "--shadow": "0 10px 40px rgba(0, 0, 0, 0.18)",
};
const DARK: typeof LIGHT = {
  "--bg": "#131211",
  "--surface": "#1c1b19",
  "--surface-2": "#272522",
  "--border": "#35322e",
  "--text": "#ece9e4",
  "--muted": "#96918a",
  "--accent": "#d4a24c",
  "--accent-text": "#1a1408",
  "--accent-soft": "rgba(212, 162, 76, 0.16)",
  "--ok": "#4cc17f",
  "--bad": "#ef6a5b",
  "--warn": "#e0a030",
  "--vp-bg": "radial-gradient(ellipse at 50% 35%, #34312d 0%, #161514 100%)",
  "--code-bg": "#171614",
  "--tok-kw": "#d28bd0",
  "--tok-num": "#7ab8f0",
  "--tok-var": "#e8a35f",
  "--tok-com": "#7d7971",
  "--tok-fn": "#5cc7bf",
  "--tok-str": "#8fcf8a",
  "--shadow": "0 10px 40px rgba(0, 0, 0, 0.6)",
};

const resolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    ...LIGHT,
    "--mantine-color-body": LIGHT["--bg"],
    "--mantine-color-text": LIGHT["--text"],
    "--mantine-color-default": LIGHT["--surface"],
    "--mantine-color-default-border": LIGHT["--border"],
    "--mantine-color-dimmed": LIGHT["--muted"],
  },
  dark: {
    ...DARK,
    "--mantine-color-body": DARK["--bg"],
    "--mantine-color-text": DARK["--text"],
    "--mantine-color-default": DARK["--surface"],
    "--mantine-color-default-border": DARK["--border"],
    "--mantine-color-dimmed": DARK["--muted"],
  },
});

/** Mantine with the app's theme preference ("auto" follows the OS). */
export function UiProvider({ children }: { children: ReactNode }) {
  const pref = useSyncExternalStore(subscribeTheme, getTheme);
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={resolver}
      defaultColorScheme="auto"
      forceColorScheme={pref === "auto" ? undefined : pref}
    >
      {children}
    </MantineProvider>
  );
}
