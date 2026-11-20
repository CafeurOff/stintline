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
  onSwitch,
}: {
  children: ReactNode;
  locale?: Locale;
  /** Opens the page in another language (the app loads its other URL); without it the
   * language switches in place. */
  onSwitch?: (locale: Locale) => void;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => forced ?? initialLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      storeLocale(next);
      if (onSwitch) {
        onSwitch(next);
        return;
      }
      void loadMessages(next).then(() => {
        setLocaleState(next);
      });
    },
    [onSwitch],
  );

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
