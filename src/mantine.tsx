import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import {
  ActionIcon,
  Button,
  Checkbox,
  Input,
  Kbd,
  MantineProvider,
  NativeSelect,
  NumberInput,
  Popover,
  SegmentedControl,
  Table,
  Tabs,
  Slider,
  TextInput,
  Textarea,
  Tooltip,
  createTheme,
  Menu,
  Modal,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";
import "@fontsource-variable/inter";
import "@mantine/core/styles.css";
import "./app.css";
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
    Button: Button.extend({
      defaultProps: { fw: 550 },
      styles: (_t: unknown, props: { variant?: string }) =>
        props.variant === undefined || props.variant === "filled"
          ? { root: { background: "var(--accent-grad)", color: "var(--accent-text)", border: "1px solid color-mix(in srgb, var(--accent) 70%, #000)", boxShadow: "0 1px 0 rgba(255,255,255,.25) inset, 0 2px 8px color-mix(in srgb, var(--accent) 30%, transparent)", transition: "filter .15s, transform .1s" } }
          : props.variant === "default"
            ? { root: { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)", transition: "background .15s, border-color .15s" } }
            : {},
    }),
    ActionIcon: ActionIcon.extend({ defaultProps: { radius: "md" } }),
    Modal: Modal.extend({
      classNames: { content: "gl-edge gl-float" },
      defaultProps: { radius: "lg", overlayProps: { color: "var(--overlay)", backgroundOpacity: 1, blur: 10 }, transitionProps: { transition: "pop", duration: 160 } },
      styles: {
        content: { background: "var(--float-bg)", boxShadow: "var(--shadow)" },
        header: { background: "transparent", borderBottom: "1px solid var(--hairline)", minHeight: 52 },
        title: { fontWeight: 650, fontSize: 15 },
      },
    }),
    Menu: Menu.extend({
      classNames: { dropdown: "gl-edge gl-float" },
      defaultProps: { radius: "md", transitionProps: { transition: "pop-top-left", duration: 120 } },
      styles: {
        dropdown: { padding: 5 },
        item: { borderRadius: 7, fontSize: 13, padding: "7px 10px" },
        divider: { borderColor: "var(--border)" },
      },
    }),
    Tooltip: Tooltip.extend({
      defaultProps: { openDelay: 350, withArrow: false, radius: "sm" },
      styles: { tooltip: { background: "var(--text)", color: "var(--bg)", fontSize: 11.5, fontWeight: 500, padding: "4px 8px", boxShadow: "var(--float-shadow)" } },
    }),
    Popover: Popover.extend({
      defaultProps: { radius: "lg", shadow: "md" },
      classNames: { dropdown: "gl-edge gl-float" },
    }),
    Slider: Slider.extend({
      defaultProps: { size: "sm", label: null },
      styles: {
        track: { "--slider-track-bg": "var(--surface-3)" } as CSSProperties,
        thumb: { background: "#fff", border: "2px solid var(--accent)", boxShadow: "0 1px 4px rgba(0,0,0,.25)", width: 14, height: 14 },
        bar: { background: "var(--accent-grad)" },
      },
    }),
    TextInput: TextInput.extend({ defaultProps: { radius: "md" } }),
    NumberInput: NumberInput.extend({ defaultProps: { radius: "md" } }),
    Textarea: Textarea.extend({ defaultProps: { radius: "md" } }),
    NativeSelect: NativeSelect.extend({ defaultProps: { radius: "md" } }),
    Checkbox: Checkbox.extend({ defaultProps: { radius: "sm" } }),
    SegmentedControl: SegmentedControl.extend({
      styles: { root: { background: "var(--surface-2)", border: "1px solid var(--border)" }, indicator: { background: "var(--surface)", boxShadow: "0 1px 3px rgba(0,0,0,.18)" } },
    }),
    Tabs: Tabs.extend({
      styles: {
        list: { borderColor: "var(--hairline)", "--tabs-list-border-width": "1px" } as CSSProperties,
        tab: { borderRadius: 10, fontWeight: 550, fontSize: 13, color: "var(--muted)", padding: "9px 12px", transition: "background .15s, color .15s" },
      },
      classNames: { tab: "tab-pill" },
    }),
    Table: Table.extend({ styles: { th: { color: "var(--muted)", fontWeight: 600 }, tr: { borderColor: "var(--hairline)" } } }),
    Input: Input.extend({
      styles: { input: { background: "color-mix(in srgb, var(--surface) 45%, transparent)", borderColor: "var(--hairline)", boxShadow: "inset 0 1px 2px rgba(0,0,0,.06)", transition: "border-color .15s, box-shadow .15s" } },
    }),
    Kbd: Kbd.extend({ styles: { root: { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--muted)", fontWeight: 500 } } }),
  },
  breakpoints: { xs: "36em", sm: "48em", md: "56.25em", lg: "74em", xl: "90em" },
  fontFamilyMonospace: 'ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace',
});

// The app's palette. Mantine writes these as CSS variables on :root for the active colour scheme,
// so components (and the 3D viewer and the code editor) read them as var(--surface), var(--accent)...
const LIGHT = {
  "--bg": "#f4f0e8",
  "--grid": "#6f6a62",
  "--grid-opacity": "0.35",
  "--gem-topaz": "#f0a830",
  "--gem-amethyst": "#9a6be0",
  "--gem-sapphire": "#3d8fe6",
  "--gem-ruby": "#e8556f",
  "--gem-emerald": "#2fb88c",
  "--gem-opacity": "0.17",

  "--surface": "#ffffff",
  "--surface-2": "#f4f2ee",
  "--surface-3": "#e9e6e0",
  "--border": "#e0dcd5",
  "--border-strong": "#c9c4ba",
  "--text": "#1b1917",
  "--muted": "#6f6a62",
  "--accent": "#8a6120",
  "--accent-2": "#b8862f",
  "--accent-text": "#ffffff",
  "--accent-soft": "rgba(138, 97, 32, 0.12)",
  "--accent-grad": "var(--accent)",
  "--ok": "#2d8a55",
  "--bad": "#c0392b",
  "--warn": "#b86e00",
  "--vp-bg": "rgba(255, 255, 255, 0.28)",
  "--code-bg": "rgba(255, 255, 255, 0.32)",
  "--pane-bg": "rgba(255, 255, 255, 0.42)",
  "--pane-border": "rgba(255, 255, 255, 0.7)",
  "--hairline": "rgba(60, 40, 10, 0.09)",
  "--float-bg": "rgba(255, 253, 249, 0.66)",
  "--spec": "rgba(255, 255, 255, 0.9)",
  "--overlay": "rgba(255, 248, 236, 0.34)",
  "--glass": "rgba(255, 255, 255, 0.55)",
  "--glass-border": "rgba(255, 255, 255, 0.75)",
  "--chip": "rgba(0, 0, 0, 0.055)",
  "--tok-kw": "#9a3f8b",
  "--tok-num": "#1f6fb2",
  "--tok-var": "#b05a1c",
  "--tok-com": "#8f8b83",
  "--tok-fn": "#1a7f7a",
  "--tok-str": "#2f7d32",
  "--shadow": "0 18px 50px rgba(30, 20, 5, 0.22)",
  "--float-shadow": "0 6px 24px rgba(30, 20, 5, 0.12), 0 1px 3px rgba(30, 20, 5, 0.08)",
  "--pane-shadow": "0 2px 4px rgba(60, 40, 10, 0.04), 0 18px 50px rgba(60, 40, 10, 0.12)",
};
const DARK: typeof LIGHT = {
  "--bg": "#0d0c0a",
  "--grid": "#e6dccb",
  "--grid-opacity": "0.42",
  "--gem-topaz": "#e8a22c",
  "--gem-amethyst": "#8250d8",
  "--gem-sapphire": "#2a7fe0",
  "--gem-ruby": "#d83a5c",
  "--gem-emerald": "#1fa87c",
  "--gem-opacity": "0.2",

  "--surface": "#171615",
  "--surface-2": "#1f1d1b",
  "--surface-3": "#292724",
  "--border": "#2a2825",
  "--border-strong": "#3d3a35",
  "--text": "#efece6",
  "--muted": "#9a948b",
  "--accent": "#dcaa55",
  "--accent-2": "#f0c675",
  "--accent-text": "#1a1206",
  "--accent-soft": "rgba(220, 170, 85, 0.14)",
  "--accent-grad": "var(--accent)",
  "--ok": "#4cc17f",
  "--bad": "#f2705f",
  "--warn": "#e8a83a",
  "--vp-bg": "rgba(0, 0, 0, 0.26)",
  "--code-bg": "rgba(0, 0, 0, 0.22)",
  "--pane-bg": "rgba(22, 20, 18, 0.42)",
  "--pane-border": "rgba(255, 255, 255, 0.1)",
  "--hairline": "rgba(255, 255, 255, 0.07)",
  "--float-bg": "rgba(24, 22, 19, 0.6)",
  "--spec": "rgba(255, 255, 255, 0.18)",
  "--overlay": "rgba(0, 0, 0, 0.42)",
  "--glass": "rgba(34, 31, 28, 0.5)",
  "--glass-border": "rgba(255, 255, 255, 0.14)",
  "--chip": "rgba(255, 255, 255, 0.07)",
  "--tok-kw": "#d896d4",
  "--tok-num": "#7ab8f0",
  "--tok-var": "#eaa863",
  "--tok-com": "#7d7971",
  "--tok-fn": "#5cc7bf",
  "--tok-str": "#8fcf8a",
  "--shadow": "0 18px 60px rgba(0, 0, 0, 0.7)",
  "--float-shadow": "0 8px 30px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4)",
  "--pane-shadow": "0 18px 50px rgba(0, 0, 0, 0.45)",
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

/**
 * Crisp, flat gem shapes behind everything. No gradients: the panes above are frosted glass, and
 * it is their blur that softens these into light.
 */
function Scene() {
  const g = (name: string) => `var(--gem-${name})`;
  return (
    <svg aria-hidden className="scene" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      <g style={{ opacity: "var(--gem-opacity)" }}>
        <circle cx="110" cy="70" r="250" fill={g("topaz")} />
        <polygon points="660,-30 850,110 770,310 560,270 500,90" fill={g("amethyst")} />
        <circle cx="1520" cy="60" r="190" fill={g("ruby")} />
        <polygon points="1090,1050 1220,780 1470,850 1560,1050" fill={g("sapphire")} />
        <circle cx="-10" cy="950" r="220" fill={g("ruby")} />
        <polygon points="330,830 540,740 650,900 510,1040 320,1020" fill={g("emerald")} />
        <circle cx="800" cy="560" r="110" fill={g("emerald")} />
        <polygon points="1190,400 1310,330 1380,470 1280,550" fill={g("topaz")} />
      </g>
    </svg>
  );
}

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
      <Scene />
      {children}
    </MantineProvider>
  );
}
