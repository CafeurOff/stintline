import type { Locale } from "./locale";

/** French typography: a no-break space before ? ! ; : so they never start a line. */
function frenchSpacing(text: string): string {
  return text.replace(/ ([?!;:])/g, "\u00a0$1");
}

/**
 * Fills `{name}` with a parameter, and `{n|lap|laps}` with the word that agrees with the
 * number `n` in this language (French: 0 and 1 take the singular).
 */
export function interpolate(
  text: string,
  params: Record<string, string | number> | undefined,
  locale: Locale,
): string {
  const typed = locale === "fr" ? frenchSpacing(text) : text;
  if (!params) return typed;
  const rules = new Intl.PluralRules(locale);
  return typed
    .replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (match, name: string, one: string, other: string) => {
      const value = params[name];
      if (value === undefined) return match;
      return rules.select(Number(value)) === "one" ? one : other;
    })
    .replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
}
