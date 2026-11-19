// Title maths of 2025 recorded from the seeded API (final standings, Norris champion at the
// last round), trimmed to the first six drivers.
import type { Schema } from "@stintline/api-types";

export const title = {
  season: 2025,
  rules: {
    race_max: 25.0,
    sprint_max: 8.0,
    all_count: true,
    blocks: [{ races: null, best: null }],
    double_last_race: false,
  },
  races_done: 24,
  races_left: 0,
  sprints_left: 0,
  points_left: 0.0,
  decided: {
    round: 24,
    event_id: 24,
    name: "Abu Dhabi Grand Prix",
    race_date: "2025-12-07",
    sprint: false,
  },
  next_round: null,
  drivers: [
    {
      driver: {
        ref: "norris",
        code: "NOR",
        given_name: "Lando",
        family_name: "Norris",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
        photo_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/mclaren/lannor01/2025mclarenlannor01right.webp",
      },
      points: 423.0,
      scored: 423.0,
      ceiling: 423.0,
      gap: 0.0,
      status: "champion",
      clinch_margin: null,
    },
    {
      driver: {
        ref: "max_verstappen",
        code: "VER",
        given_name: "Max",
        family_name: "Verstappen",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg",
        photo_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/redbullracing/maxver01/2025redbullracingmaxver01right.webp",
      },
      points: 421.0,
      scored: 421.0,
      ceiling: 421.0,
      gap: 2.0,
      status: "out",
      clinch_margin: null,
    },
    {
      driver: {
        ref: "piastri",
        code: "PIA",
        given_name: "Oscar",
        family_name: "Piastri",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
        photo_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/mclaren/oscpia01/2025mclarenoscpia01right.webp",
      },
      points: 410.0,
      scored: 410.0,
      ceiling: 410.0,
      gap: 13.0,
      status: "out",
      clinch_margin: null,
    },
    {
      driver: {
        ref: "russell",
        code: "RUS",
        given_name: "George",
        family_name: "Russell",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg/500px-KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg",
        photo_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/mercedes/georus01/2025mercedesgeorus01right.webp",
      },
      points: 319.0,
      scored: 319.0,
      ceiling: 319.0,
      gap: 104.0,
      status: "out",
      clinch_margin: null,
    },
    {
      driver: {
        ref: "leclerc",
        code: "LEC",
        given_name: "Charles",
        family_name: "Leclerc",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg/500px-Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg",
        photo_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/ferrari/chalec01/2025ferrarichalec01right.webp",
      },
      points: 242.0,
      scored: 242.0,
      ceiling: 242.0,
      gap: 181.0,
      status: "out",
      clinch_margin: null,
    },
    {
      driver: {
        ref: "hamilton",
        code: "HAM",
        given_name: "Lewis",
        family_name: "Hamilton",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg/500px-Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg",
        photo_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/ferrari/lewham01/2025ferrarilewham01right.webp",
      },
      points: 156.0,
      scored: 156.0,
      ceiling: 156.0,
      gap: 267.0,
      status: "out",
      clinch_margin: null,
    },
  ],
} satisfies Schema<"Title">;
