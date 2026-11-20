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

/** French pages live under `/fr`, English ones at the root: each language has its own URL. */
export const FRENCH_PREFIX = "/fr";
const FRENCH_PATH = /^\/fr(?=\/|$)/;

/** The language a path is written in. */
export function pathLocale(pathname: string): Locale {
  return FRENCH_PATH.test(pathname) ? "fr" : "en";
}

/** The same page in `locale`: `/drivers/norris` and `/fr/drivers/norris`. */
export function localePath(pathname: string, locale: Locale): string {
  const bare = pathname.replace(FRENCH_PATH, "") || "/";
  if (locale === "en") return bare;
  return bare === "/" ? `${FRENCH_PREFIX}/` : `${FRENCH_PREFIX}${bare}`;
}
