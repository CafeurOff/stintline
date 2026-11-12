import type { Locale } from "./locale";

/**
 * Countries and nationalities as the API spells them (Jolpica, English) mapped to ISO 3166
 * region codes, so `Intl.DisplayNames` can name them in the reader's language.
 */
const COUNTRY_CODES: Record<string, string> = {
  Argentina: "AR",
  Australia: "AU",
  Austria: "AT",
  Azerbaijan: "AZ",
  Bahrain: "BH",
  Belgium: "BE",
  Brazil: "BR",
  Canada: "CA",
  China: "CN",
  France: "FR",
  Germany: "DE",
  Hungary: "HU",
  India: "IN",
  Italy: "IT",
  Japan: "JP",
  Korea: "KR",
  Malaysia: "MY",
  Mexico: "MX",
  Monaco: "MC",
  Morocco: "MA",
  Netherlands: "NL",
  Portugal: "PT",
  Qatar: "QA",
  Russia: "RU",
  "Saudi Arabia": "SA",
  Singapore: "SG",
  "South Africa": "ZA",
  Spain: "ES",
  Sweden: "SE",
  Switzerland: "CH",
  Turkey: "TR",
  UAE: "AE",
  "United Arab Emirates": "AE",
  UK: "GB",
  "United Kingdom": "GB",
  USA: "US",
  "United States": "US",
  Vietnam: "VN",
};

const NATIONALITY_CODES: Record<string, string> = {
  American: "US",
  Argentine: "AR",
  Argentinian: "AR",
  Australian: "AU",
  Austrian: "AT",
  Belgian: "BE",
  Brazilian: "BR",
  British: "GB",
  Canadian: "CA",
  Chilean: "CL",
  Chinese: "CN",
  Colombian: "CO",
  Czech: "CZ",
  Danish: "DK",
  Dutch: "NL",
  "East German": "DE",
  Finnish: "FI",
  French: "FR",
  German: "DE",
  Hungarian: "HU",
  Indian: "IN",
  Indonesian: "ID",
  Irish: "IE",
  Italian: "IT",
  Japanese: "JP",
  Liechtensteiner: "LI",
  Malaysian: "MY",
  Mexican: "MX",
  Monegasque: "MC",
  Moroccan: "MA",
  "New Zealander": "NZ",
  Polish: "PL",
  Portuguese: "PT",
  Rhodesian: "ZW",
  Russian: "RU",
  "South African": "ZA",
  Spanish: "ES",
  Swedish: "SE",
  Swiss: "CH",
  Thai: "TH",
  Uruguayan: "UY",
  Venezuelan: "VE",
};

const displayNames = new Map<Locale, Intl.DisplayNames>();

function regionName(code: string, locale: Locale): string | undefined {
  let names = displayNames.get(locale);
  if (!names) {
    names = new Intl.DisplayNames([locale === "fr" ? "fr-FR" : "en-GB"], { type: "region" });
    displayNames.set(locale, names);
  }
  return names.of(code);
}

/** ISO 3166 code of a country as the API spells it, lower case (`Brazil` -> `br`). */
export function countryCode(country: string): string | null {
  const code = COUNTRY_CODES[country] ?? (/^[A-Z]{2}$/.test(country) ? country : undefined);
  return code ? code.toLowerCase() : null;
}

/** ISO 3166 code of a nationality (`British` -> `gb`). */
export function nationalityCode(nationality: string): string | null {
  const code = NATIONALITY_CODES[nationality];
  return code ? code.toLowerCase() : null;
}

/** Country name in the reader's language (`UK` -> `Royaume-Uni`), else the API text. */
export function countryName(country: string, locale: Locale): string {
  const code = COUNTRY_CODES[country];
  return (code && regionName(code, locale)) ?? country;
}

/**
 * Country a nationality belongs to, in the reader's language (`British` -> `Royaume-Uni`).
 * Shown as "Nationality: country", which avoids gendered French adjectives.
 */
export function nationalityCountry(nationality: string, locale: Locale): string {
  if (locale === "en") return nationality;
  const code = NATIONALITY_CODES[nationality];
  return (code && regionName(code, locale)) ?? nationality;
}
