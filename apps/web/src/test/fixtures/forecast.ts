// Forecasts in the API's shape for the Hungarian Grand Prix sessions of the fixtures
// (a shower during qualifying, a dry race). Built by hand: forecasts only exist for
// sessions in the next two weeks.
import type { Schema } from "@stintline/api-types";

function hours(start: string, values: [number, number, number, number][]) {
  const from = Date.parse(start);
  return values.map(([air, rain, mm, code], i) => ({
    at: new Date(from + i * 3_600_000).toISOString(),
    air_c: air,
    rain_probability_pct: rain,
    precipitation_mm: mm,
    wind_ms: 3.2,
    weather_code: code,
  }));
}

export const forecasts: Schema<"SessionForecast">[] = [
  {
    session_id: 69,
    event_id: 14,
    kind: "Q",
    fetched_at: "2025-07-30T09:00:00Z",
    window_start: "2025-08-02T14:00:00Z",
    window_end: "2025-08-02T15:00:00Z",
    air_c: 27.4,
    air_min_c: 26.8,
    air_max_c: 28.0,
    rain_probability_pct: 55,
    precipitation_mm: 0.6,
    wind_ms: 4.1,
    weather_code: 61,
    hours: hours("2025-08-02T13:00:00Z", [
      [28, 20, 0, 2],
      [28, 55, 0.6, 61],
      [27, 35, 0, 3],
    ]),
  },
  {
    session_id: 70,
    event_id: 14,
    kind: "R",
    fetched_at: "2025-07-30T09:00:00Z",
    window_start: "2025-08-03T13:00:00Z",
    window_end: "2025-08-03T15:00:00Z",
    air_c: 31.2,
    air_min_c: 30.1,
    air_max_c: 32.0,
    rain_probability_pct: 5,
    precipitation_mm: 0,
    wind_ms: 2.5,
    weather_code: 0,
    hours: hours("2025-08-03T12:00:00Z", [
      [30, 5, 0, 0],
      [31, 5, 0, 0],
      [32, 0, 0, 0],
      [32, 0, 0, 1],
    ]),
  },
];
