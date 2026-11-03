import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { createFormatters } from "../format";
import { en, type MessageKey } from "./en";
import { fr } from "./fr";
import { I18nContext, type I18nValue } from "./context";
import { initialLocale, type Locale, storeLocale } from "./locale";

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, fr };

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Provides the language, the translator and locale-aware formatters. */
export function I18nProvider({
  children,
  locale: forced,
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => forced ?? initialLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    storeLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => interpolate(MESSAGES[locale][key], params),
      f: createFormatters(locale),
    }),
    [locale, setLocale],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}
