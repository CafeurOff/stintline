export type Locale = "en" | "fr";

export const LOCALES: readonly Locale[] = ["fr", "en"];
export const LOCALE_STORAGE_KEY = "stintline-locale";

/** Stored choice, else the browser language (French for any `fr-*`), else English. */
export function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    // Storage blocked: fall through to the browser language.
  }
  const language = typeof navigator === "undefined" ? "" : navigator.language;
  return language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export function storeLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The choice still applies for this page view.
  }
}
