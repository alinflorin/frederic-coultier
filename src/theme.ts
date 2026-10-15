export type Theme = "auto" | "light" | "dark";
export const THEMES: Theme[] = ["auto", "light", "dark"];

const KEY = "theme";

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (THEMES as string[]).includes(saved)) return saved as Theme;
  } catch {
    // storage unavailable: fall back to the default
  }
  return "auto";
}

/** "auto" leaves the attribute off so the CSS follows the OS setting. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ignore
  }
  applyTheme(theme);
}
