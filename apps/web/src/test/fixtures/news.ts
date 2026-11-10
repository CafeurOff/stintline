// Race reports recorded from the demo API (Hungary 2025 race, Qatar 2025 sprint) and
// headlines parsed from the recorded feeds (packages/racedata/fixtures/feeds).
import type { Schema } from "@stintline/api-types";

export const hungaryReport = {
  session_id: 70,
  kind: "R",
  event: {
    id: 14,
    season: 2025,
    round: 14,
    name: "Hungarian Grand Prix",
    race_date: "2025-08-03",
    format: "conventional",
    circuit: {
      ref: "hungaroring",
      name: "Hungaroring",
      locality: "Budapest",
      country: "Hungary",
      latitude: 47.5789,
      longitude: 19.2486,
      wikipedia_url: "https://en.wikipedia.org/wiki/Hungaroring",
    },
  },
  finished_at: "2025-08-03T15:00:00Z",
  winner: {
    car_number: 4,
    driver: {
      ref: "norris",
      code: "NOR",
      given_name: "Lando",
      family_name: "Norris",
      portrait_url:
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
    },
    team: {
      ref: "mclaren",
      name: "McLaren",
    },
    team_colour: "F47600",
    grid_position: 3,
    finish_position: 1,
    status: "Finished",
    fastest_lap_s: 79.918,
  },
  winner_wins: 5,
  podium: [
    {
      entry: {
        car_number: 4,
        driver: {
          ref: "norris",
          code: "NOR",
          given_name: "Lando",
          family_name: "Norris",
          portrait_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
        },
        team: {
          ref: "mclaren",
          name: "McLaren",
        },
        team_colour: "F47600",
        grid_position: 3,
        finish_position: 1,
        status: "Finished",
        fastest_lap_s: 79.918,
      },
      gap_s: null,
      laps_down: 0,
    },
    {
      entry: {
        car_number: 81,
        driver: {
          ref: "piastri",
          code: "PIA",
          given_name: "Oscar",
          family_name: "Piastri",
          portrait_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
        },
        team: {
          ref: "mclaren",
          name: "McLaren",
        },
        team_colour: "F47600",
        grid_position: 2,
        finish_position: 2,
        status: "Finished",
        fastest_lap_s: 79.412,
      },
      gap_s: 0.698,
      laps_down: 0,
    },
    {
      entry: {
        car_number: 63,
        driver: {
          ref: "russell",
          code: "RUS",
          given_name: "George",
          family_name: "Russell",
          portrait_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg/500px-KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg",
        },
        team: {
          ref: "mercedes",
          name: "Mercedes",
        },
        team_colour: "00D7B6",
        grid_position: 4,
        finish_position: 3,
        status: "Finished",
        fastest_lap_s: 79.40899999999999,
      },
      gap_s: 21.916,
      laps_down: 0,
    },
  ],
  starters: 20,
  classified: 20,
  biggest_gain: {
    car_number: 12,
    driver: {
      ref: "antonelli",
      code: "ANT",
      given_name: "Andrea Kimi",
      family_name: "Antonelli",
      portrait_url:
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/2026-08-23_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2026_STP_3010_%28cropped2%29.jpg/500px-2026-08-23_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2026_STP_3010_%28cropped2%29.jpg",
    },
    team: {
      ref: "mercedes",
      name: "Mercedes",
    },
    team_colour: "00D7B6",
    grid_position: 15,
    finish_position: 10,
    status: "Lapped",
    fastest_lap_s: 80.745,
  },
  fastest_lap: {
    car_number: 63,
    driver: {
      ref: "russell",
      code: "RUS",
      given_name: "George",
      family_name: "Russell",
      portrait_url:
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg/500px-KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg",
    },
    team: {
      ref: "mercedes",
      name: "Mercedes",
    },
    team_colour: "00D7B6",
    grid_position: 4,
    finish_position: 3,
    status: "Finished",
    fastest_lap_s: 79.40899999999999,
  },
  retirements: [
    {
      car_number: 87,
      driver: {
        ref: "bearman",
        code: "BEA",
        given_name: "Oliver",
        family_name: "Bearman",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/2025_Japan_GP_-_Haas_-_Oliver_Bearman_-_Thursday_%28cropped%29.jpg/500px-2025_Japan_GP_-_Haas_-_Oliver_Bearman_-_Thursday_%28cropped%29.jpg",
      },
      team: {
        ref: "haas",
        name: "Haas F1 Team",
      },
      team_colour: "9C9FA2",
      grid_position: 11,
      finish_position: 20,
      status: "Retired",
      fastest_lap_s: 81.989,
    },
  ],
  neutralisations: {
    safety_cars: 0,
    virtual_safety_cars: 0,
    red_flags: 0,
  },
  rain: false,
  winner_strategy: {
    stops: 1,
    compounds: ["MEDIUM", "HARD"],
  },
  championship: {
    round: 14,
    leader: {
      ref: "piastri",
      code: "PIA",
      given_name: "Oscar",
      family_name: "Piastri",
      portrait_url:
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
    },
    points: 284.0,
    second: {
      ref: "norris",
      code: "NOR",
      given_name: "Lando",
      family_name: "Norris",
      portrait_url:
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
    },
    lead: 9.0,
    leader_changed: false,
  },
} satisfies Schema<"RaceReport">;

export const sprintReport = {
  session_id: 113,
  kind: "SPRINT",
  event: {
    id: 23,
    season: 2025,
    round: 23,
    name: "Qatar Grand Prix",
    race_date: "2025-11-30",
    format: "sprint",
    circuit: {
      ref: "losail",
      name: "Lusail International Circuit",
      locality: "Lusail",
      country: "Qatar",
      latitude: 25.49,
      longitude: 51.4542,
      wikipedia_url: "https://en.wikipedia.org/wiki/Lusail_International_Circuit",
    },
  },
  finished_at: "2025-11-29T14:00:00Z",
  winner: {
    car_number: 81,
    driver: {
      ref: "piastri",
      code: "PIA",
      given_name: "Oscar",
      family_name: "Piastri",
      portrait_url:
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
    },
    team: {
      ref: "mclaren",
      name: "McLaren",
    },
    team_colour: "F47600",
    grid_position: 1,
    finish_position: 1,
    status: "Finished",
    fastest_lap_s: 83.988,
  },
  winner_wins: null,
  podium: [
    {
      entry: {
        car_number: 81,
        driver: {
          ref: "piastri",
          code: "PIA",
          given_name: "Oscar",
          family_name: "Piastri",
          portrait_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
        },
        team: {
          ref: "mclaren",
          name: "McLaren",
        },
        team_colour: "F47600",
        grid_position: 1,
        finish_position: 1,
        status: "Finished",
        fastest_lap_s: 83.988,
      },
      gap_s: null,
      laps_down: 0,
    },
    {
      entry: {
        car_number: 63,
        driver: {
          ref: "russell",
          code: "RUS",
          given_name: "George",
          family_name: "Russell",
          portrait_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg/500px-KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg",
        },
        team: {
          ref: "mercedes",
          name: "Mercedes",
        },
        team_colour: "00D7B6",
        grid_position: 2,
        finish_position: 2,
        status: "Finished",
        fastest_lap_s: 84.564,
      },
      gap_s: 4.951,
      laps_down: 0,
    },
    {
      entry: {
        car_number: 4,
        driver: {
          ref: "norris",
          code: "NOR",
          given_name: "Lando",
          family_name: "Norris",
          portrait_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
        },
        team: {
          ref: "mclaren",
          name: "McLaren",
        },
        team_colour: "F47600",
        grid_position: 3,
        finish_position: 3,
        status: "Finished",
        fastest_lap_s: 84.507,
      },
      gap_s: 6.279,
      laps_down: 0,
    },
  ],
  starters: 20,
  classified: 20,
  biggest_gain: null,
  fastest_lap: {
    car_number: 10,
    driver: {
      ref: "gasly",
      code: "GAS",
      given_name: "Pierre",
      family_name: "Gasly",
      portrait_url:
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Pierre_Gasly_2017_Malaysia.jpg/500px-Pierre_Gasly_2017_Malaysia.jpg",
    },
    team: {
      ref: "alpine",
      name: "Alpine F1 Team",
    },
    team_colour: "00A1E8",
    grid_position: 19,
    finish_position: 18,
    status: "Finished",
    fastest_lap_s: 83.188,
  },
  retirements: [],
  neutralisations: null,
  rain: null,
  winner_strategy: null,
  championship: null,
} satisfies Schema<"RaceReport">;

export const headlines = [
  {
    source: "racefans",
    source_name: "RaceFans",
    language: "en",
    title: "Social Media: Hamilton witnesses humanitarian relief effort in Gaza Strip",
    url: "https://www.racefans.net/2026/11/10/social-media-hamilton-witnesses-humanitarian-relief-effort-in-gaza-strip/",
    published_at: "2026-11-10T21:38:25Z",
  },
  {
    source: "f1i",
    source_name: "F1i",
    language: "en",
    title: "'The car was phenomenal\u2019: Alonso finds reason to smile",
    url: "https://f1i.com/news/577871-the-car-was-phenomenal-alonso-finds-reason-to-smile.html",
    published_at: "2026-11-10T16:53:04Z",
  },
  {
    source: "motorsport-fr",
    source_name: "Motorsport.com France",
    language: "fr",
    title:
      'Verstappen sur les accrochages chez Ferrari : "Je ne signerais jamais deux pilotes num\u00e9ro 1"',
    url: "https://fr.motorsport.com/f1/news/max-verstappen-accrochages-ferrari-signerais-jamais-deux-pilotes-numero-1/10873625/",
    published_at: "2026-11-10T16:38:04Z",
  },
  {
    source: "racefans",
    source_name: "RaceFans",
    language: "en",
    title:
      "F1 scraps back-up plan to race at Imola if Middle East GPs are cancelled \u2013 reports",
    url: "https://www.racefans.net/2026/11/10/f1-scraps-back-up-plan-to-race-at-imola-if-middle-east-gps-are-cancelled-reports/",
    published_at: "2026-11-10T15:58:22Z",
  },
  {
    source: "f1i",
    source_name: "F1i",
    language: "en",
    title: "F1 tells Imola it won't be needed for season finale",
    url: "https://f1i.com/news/577876-f1-tells-imola-it-wont-be-needed-for-season-finale.html",
    published_at: "2026-11-10T15:26:31Z",
  },
  {
    source: "autosport",
    source_name: "Autosport",
    language: "en",
    title: "F1 2026 calendar update: Imola off the table, no plan B if Iran war escalates",
    url: "https://www.autosport.com/f1/news/f1-2026-calendar-update-imola-off-the-table-no-plan-b-if-iran-war-escalates/10873643/",
    published_at: "2026-11-10T14:52:26Z",
  },
  {
    source: "motorsport-fr",
    source_name: "Motorsport.com France",
    language: "fr",
    title:
      "Calendrier F1 2026 : Imola \u00e9cart\u00e9, aucun plan B en cas d'escalade de la guerre",
    url: "https://fr.motorsport.com/f1/news/calendrier-f1-2026-imola-ecarte-plan-b-escalade-guerre/10873641/",
    published_at: "2026-11-10T14:51:12Z",
  },
  {
    source: "autosport",
    source_name: "Autosport",
    language: "en",
    title: "FIA reveals ADUO results in final review of 2026 F1 season",
    url: "https://www.autosport.com/f1/news/fia-reveals-aduo-results-in-final-review-of-2026-f1-season/10873566/",
    published_at: "2026-11-10T11:45:39Z",
  },
] satisfies Schema<"Headline">[];
