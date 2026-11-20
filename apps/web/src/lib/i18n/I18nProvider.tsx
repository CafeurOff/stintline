import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { createFormatters } from "../format";
import { I18nContext, type I18nValue } from "./context";
import { interpolate } from "./interpolate";
import { initialLocale, type Locale, storeLocale } from "./locale";
import { loadedMessages, loadMessages } from "./messages";

/**
 * Provides the language, the translator and locale-aware formatters. The dictionary of the
 * starting language must be loaded first (`loadMessages`); a missing one shows the keys.
 */
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
    void loadMessages(next).then(() => {
      setLocaleState(next);
    });
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => interpolate(loadedMessages(locale)?.[key] ?? key, params, locale),
      f: createFormatters(locale),
    }),
    [locale, setLocale],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}
