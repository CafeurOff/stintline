/** WMO weather interpretation codes, grouped the way a fan reads a forecast. */
export type WeatherKind =
  "clear" | "cloudy" | "overcast" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export function weatherKind(code: number | null | undefined): WeatherKind | null {
  if (code == null) return null;
  if (code === 0) return "clear";
  if (code <= 2) return "cloudy";
  if (code === 3) return "overcast";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67 || (code >= 80 && code <= 82)) return "rain";
  if (code <= 86) return "snow";
  return "storm";
}

/** A session is worth a rain warning from this hourly chance on. */
export const RAIN_WARNING_PCT = 40;
