import type { MessageKey } from "./en";
import type { Locale } from "./locale";

type Messages = Record<MessageKey, string>;

/**
 * Each dictionary is its own chunk (about 18 kB gzipped): a visitor downloads only the
 * language they read. `main.tsx` loads the first one before rendering, and a language switch
 * loads the other one before it applies.
 */
const LOADERS: Record<Locale, () => Promise<Messages>> = {
  en: async () => (await import("./en")).en,
  fr: async () => (await import("./fr")).fr,
};

const loaded: Partial<Record<Locale, Messages>> = {};

export async function loadMessages(locale: Locale): Promise<Messages> {
  const messages = loaded[locale] ?? (await LOADERS[locale]());
  loaded[locale] = messages;
  return messages;
}

/** The dictionary of `locale`, once `loadMessages` has resolved for it. */
export function loadedMessages(locale: Locale): Messages | undefined {
  return loaded[locale];
}
