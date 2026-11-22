// Team radio of the Hungarian Grand Prix 2025 (session 70) in the shape the API returns;
// transcripts written for the tests (ADR 0029).
import type { Schema } from "@stintline/api-types";

const BASE =
  "https://livetiming.formula1.com/static/2025/2025-08-03_Hungarian_Grand_Prix/2025-08-03_Race/TeamRadio";

export const radio: Schema<"TeamRadio">[] = [
  {
    car_number: 4,
    recorded_at: "2025-08-03T13:21:04Z",
    url: `${BASE}/LANNOR01_4_20250803_152104.mp3`,
    lap: 12,
    lap_fraction: 0.5,
    transcript: "Gap to Leclerc is three seconds, keep managing the rears.",
    transcript_confidence: 0.82,
  },
  {
    car_number: 81,
    recorded_at: "2025-08-03T13:40:12Z",
    url: `${BASE}/OSCPIA01_81_20250803_154012.mp3`,
    lap: 31,
    lap_fraction: 0.5,
    transcript: "Box box, box this lap.",
    transcript_confidence: 0.91,
  },
  {
    car_number: 4,
    recorded_at: "2025-08-03T14:02:40Z",
    url: `${BASE}/LANNOR01_4_20250803_160240.mp3`,
    lap: 52,
    lap_fraction: 0.5,
    transcript: "Don't box, we go to the end on these.",
    transcript_confidence: 0.44,
  },
  {
    car_number: 4,
    recorded_at: "2025-08-03T14:20:00Z",
    url: `${BASE}/LANNOR01_4_20250803_162000.mp3`,
    lap: 69,
    lap_fraction: 0.5,
    transcript: "",
    transcript_confidence: null,
  },
  {
    car_number: 4,
    recorded_at: "2025-08-03T14:24:00Z",
    url: `${BASE}/LANNOR01_4_20250803_162400.mp3`,
    lap: 70,
    lap_fraction: 0.5,
    transcript: null,
    transcript_confidence: null,
  },
];
