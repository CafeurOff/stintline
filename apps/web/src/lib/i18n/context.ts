import { createContext, use } from "react";

import type { Formatters } from "../format";
import type { MessageKey } from "./en";
import type { Locale } from "./locale";

export interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  f: Formatters;
}

export const I18nContext = createContext<I18nValue | null>(null);

/** Translator and formatters for the current language. */
export function useI18n(): I18nValue {
  const value = use(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}
