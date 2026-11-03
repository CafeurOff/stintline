import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "stintline-theme";
const listeners = new Set<() => void>();

/** Stored choice, else dark (the default theme). Storage can throw in private modes. */
export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current theme and a setter that persists the choice and updates <html data-theme>. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, (): Theme => "dark");
  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The choice still applies for this page view.
    }
    listeners.forEach((listener) => {
      listener();
    });
  }, []);
  return { theme, setTheme };
}
