export type Theme = "auto" | "light" | "dark";
export const THEMES: Theme[] = ["auto", "light", "dark"];

import { getPref, setPref } from "./prefs";

const KEY = "theme";

export function getTheme(): Theme {
  const saved = getPref<string>(KEY);
  return saved && (THEMES as string[]).includes(saved) ? (saved as Theme) : "auto";
}

/** "auto" leaves the attribute off so the CSS follows the OS setting. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

const listeners = new Set<() => void>();

/** For `useSyncExternalStore`: lets the UI library follow theme changes. */
export function subscribeTheme(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

export function setTheme(theme: Theme) {
  setPref(KEY, theme);
  applyTheme(theme);
  listeners.forEach((cb) => cb());
}
