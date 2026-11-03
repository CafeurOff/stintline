import type { Locale } from "./i18n/locale";

const EM_DASH = "—";
const MINUS = "−";

export interface Formatters {
  /** `21.3 s` / `21,3 s`. */
  seconds: (value: number | null | undefined, digits?: number) => string;
  /** Signed: `+1.2 s`, `−0.4 s`. */
  delta: (value: number, digits?: number) => string;
  /** `45 ms`. */
  millis: (seconds: number) => string;
  /** `1:20.642` / `1:20,642`. */
  lapTime: (value: number | null | undefined) => string;
  /** Clamped at the ends: `<1%` / `<1 %`. */
  probability: (p: number) => string;
  percent: (ratio: number) => string;
  /** `5th` / `5e`, `1st` / `1er`. */
  ordinal: (n: number) => string;
  number: (value: number, digits?: number) => string;
  /** Calendar date of a race (`3 Aug 2025` / `3 août 2025`). */
  date: (isoDate: string) => string;
}

const EN_SUFFIX: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };

export function createFormatters(locale: Locale): Formatters {
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const fixed = (digits: number) =>
    new Intl.NumberFormat(tag, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const pct = new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 0 });
  const enOrdinal = new Intl.PluralRules("en-GB", { type: "ordinal" });
  const dateFormat = new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const unitSpace = " ";

  const number = (value: number, digits = 1) => fixed(digits).format(value);
  const seconds = (value: number | null | undefined, digits = 1) =>
    value == null || !Number.isFinite(value) ? EM_DASH : `${number(value, digits)}${unitSpace}s`;

  return {
    number,
    seconds,
    delta(value, digits = 1) {
      const rounded = Number(value.toFixed(digits));
      const sign = rounded > 0 ? "+" : rounded < 0 ? MINUS : "±";
      return `${sign}${number(Math.abs(rounded), digits)}${unitSpace}s`;
    },
    millis: (value) => `${Math.round(value * 1000)}${unitSpace}ms`,
    lapTime(value) {
      if (value == null || !Number.isFinite(value)) return EM_DASH;
      const minutes = Math.floor(value / 60);
      const rest = number(value - minutes * 60, 3);
      return minutes > 0 ? `${minutes}:${rest.padStart(6, "0")}` : rest;
    },
    probability(p) {
      if (p < 0.01) return `<${pct.format(0.01)}`;
      if (p > 0.99) return `>${pct.format(0.99)}`;
      return pct.format(p);
    },
    percent: (ratio) => pct.format(ratio),
    ordinal(n) {
      if (locale === "fr") return n === 1 ? "1er" : `${n}e`;
      return `${n}${EN_SUFFIX[enOrdinal.select(n)] ?? "th"}`;
    },
    date: (isoDate) => dateFormat.format(new Date(isoDate)),
  };
}
