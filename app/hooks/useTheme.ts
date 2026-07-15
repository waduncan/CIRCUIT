import { useCallback, useEffect, useState } from "react";

// Light/dark theme with browser persistence (issue #49). The saved choice is applied before first
// paint by an inline script in index.html; this hook keeps that in sync and lets the user change it.
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "circuit-theme";

function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initialTheme(): Theme {
  // Prefer what the pre-paint script already applied, then storage, then the OS preference.
  const applied = typeof document !== "undefined" ? document.documentElement.dataset.theme : undefined;
  if (applied === "light" || applied === "dark") return applied;
  return readStoredTheme() ?? systemTheme();
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // Reflect the theme on <html data-theme> and persist the explicit choice for next load.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* storage unavailable (private mode) — the theme still applies for this session */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(() => setThemeState((current) => (current === "dark" ? "light" : "dark")), []);

  return { theme, setTheme, toggleTheme, isDark: theme === "dark" };
}
