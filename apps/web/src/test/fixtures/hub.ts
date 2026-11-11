// Recorded from the local API (2025 season, real data), trimmed. Refs, not ids, link pages.
import type { Schema } from "@stintline/api-types";

export const drivers = {
  count: 4,
  next: null,
  previous: null,
  results: [
    {
      ref: "hamilton",
      code: "HAM",
      given_name: "Lewis",
      family_name: "Hamilton",
      permanent_number: 44,
      date_of_birth: "1985-01-07",
      nationality: "British",
      wikipedia_url: "http://en.wikipedia.org/wiki/Lewis_Hamilton",
      photo_url: null,
      portrait: {
        image_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg/500px-Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg",
        artist: "Picture by Lauren Hurley / No 10 Downing Street",
        license: "OGL 3",
        license_url: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3",
        file_page_url:
          "https://commons.wikimedia.org/wiki/File:Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_(54566928382)_(cropped).jpg",
      },
      team: {
        ref: "ferrari",
        name: "Ferrari",
        colour: "ED1131",
      },
      season: {
        car_number: 44,
        position: 6,
        points: 156.0,
      },
    },
    {
      ref: "leclerc",
      code: "LEC",
      given_name: "Charles",
      family_name: "Leclerc",
      permanent_number: 16,
      date_of_birth: "1997-10-16",
      nationality: "Monegasque",
      wikipedia_url: "http://en.wikipedia.org/wiki/Charles_Leclerc",
      photo_url: null,
      portrait: {
        image_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg/500px-Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg",
        artist: "Gabriel Hutchinson",
        license: "CC BY-SA 4.0",
        license_url: "https://creativecommons.org/licenses/by-sa/4.0",
        file_page_url:
          "https://commons.wikimedia.org/wiki/File:Charles_Leclerc_at_the_2026_Cannes_Film_Festival_(cropped).jpg",
      },
      team: {
        ref: "ferrari",
        name: "Ferrari",
        colour: "ED1131",
      },
      season: {
        car_number: 16,
        position: 5,
        points: 242.0,
      },
    },
    {
      ref: "norris",
      code: "NOR",
      given_name: "Lando",
      family_name: "Norris",
      permanent_number: 1,
      date_of_birth: "1999-11-13",
      nationality: "British",
      wikipedia_url: "http://en.wikipedia.org/wiki/Lando_Norris",
      photo_url: null,
      portrait: {
        image_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
        artist: "Original: Steffen Prößdorf ; Derivative work: Mb2437",
        license: "CC BY-SA 4.0",
        license_url: "https://creativecommons.org/licenses/by-sa/4.0",
        file_page_url:
          "https://commons.wikimedia.org/wiki/File:2024-08-25_Motorsport,_Formel_1,_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_(cropped2).jpg",
      },
      team: {
        ref: "mclaren",
        name: "McLaren",
        colour: "F47600",
      },
      season: {
        car_number: 4,
        position: 1,
        points: 423.0,
      },
    },
    {
      ref: "piastri",
      code: "PIA",
      given_name: "Oscar",
      family_name: "Piastri",
      permanent_number: 81,
      date_of_birth: "2001-04-06",
      nationality: "Australian",
      wikipedia_url: "http://en.wikipedia.org/wiki/Oscar_Piastri",
      photo_url: null,
      portrait: {
        image_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
        artist: "Liauzh",
        license: "CC BY 4.0",
        license_url: "https://creativecommons.org/licenses/by/4.0",
        file_page_url:
          "https://commons.wikimedia.org/wiki/File:2026_Chinese_GP_-_Oscar_Piastri_(cropped)_(cropped).jpg",
      },
      team: {
        ref: "mclaren",
        name: "McLaren",
        colour: "F47600",
      },
      season: {
        car_number: 81,
        position: 3,
        points: 410.0,
      },
    },
  ],
} satisfies Schema<"PaginatedDriverListItemList">;

export const driver = {
  driver: {
    ref: "norris",
    code: "NOR",
    given_name: "Lando",
    family_name: "Norris",
    permanent_number: 1,
    date_of_birth: "1999-11-13",
    nationality: "British",
    wikipedia_url: "http://en.wikipedia.org/wiki/Lando_Norris",
    photo_url: null,
    portrait: {
      image_url:
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
      artist: "Original: Steffen Prößdorf ; Derivative work: Mb2437",
      license: "CC BY-SA 4.0",
      license_url: "https://creativecommons.org/licenses/by-sa/4.0",
      file_page_url:
        "https://commons.wikimedia.org/wiki/File:2024-08-25_Motorsport,_Formel_1,_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_(cropped2).jpg",
    },
  },
  media: {
    driver_image_url:
      "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp",
    car_image_url:
      "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2026/mclaren/2026mclarencarright.webp",
  },
  latest_team: {
    ref: "mclaren",
    name: "McLaren",
    colour: "F47600",
  },
  latest_car_number: 1,
  totals: {
    seasons: 4,
    first_season: 2023,
    last_season: 2026,
    starts: 77,
    wins: 11,
    podiums: 40,
    poles: 15,
    fastest_laps: 14,
    points: 1087.0,
    championships: 1,
    best_finish: 1,
  },
  seasons: [
    {
      year: 2023,
      teams: ["McLaren"],
      starts: 22,
      wins: 0,
      podiums: 7,
      points: 205.0,
      championship_position: 6,
    },
    {
      year: 2024,
      teams: ["McLaren"],
      starts: 24,
      wins: 4,
      podiums: 13,
      points: 374.0,
      championship_position: 2,
    },
    {
      year: 2025,
      teams: ["McLaren"],
      starts: 24,
      wins: 7,
      podiums: 18,
      points: 423.0,
      championship_position: 1,
    },
    {
      year: 2026,
      teams: ["McLaren"],
      starts: 7,
      wins: 0,
      podiums: 2,
      points: 85.0,
      championship_position: null,
    },
  ],
} satisfies Schema<"DriverCareer">;

export const driverResults = {
  count: 4,
  next: null,
  previous: null,
  results: [
    {
      session_id: 120,
      event_id: 24,
      has_data: true,
      kind: "R",
      season: 2025,
      round: 24,
      event_name: "Abu Dhabi Grand Prix",
      race_date: "2025-12-07",
      team: {
        ref: "mclaren",
        name: "McLaren",
      },
      car_number: 4,
      grid_position: 2,
      finish_position: 3,
      classification: "3",
      status: "Finished",
      points: 15.0,
      fastest_lap_rank: 3,
    },
    {
      session_id: 115,
      event_id: 23,
      has_data: true,
      kind: "R",
      season: 2025,
      round: 23,
      event_name: "Qatar Grand Prix",
      race_date: "2025-11-30",
      team: {
        ref: "mclaren",
        name: "McLaren",
      },
      car_number: 4,
      grid_position: 2,
      finish_position: 4,
      classification: "4",
      status: "Finished",
      points: 12.0,
      fastest_lap_rank: 2,
    },
    {
      session_id: 113,
      event_id: 23,
      has_data: true,
      kind: "SPRINT",
      season: 2025,
      round: 23,
      event_name: "Qatar Grand Prix",
      race_date: "2025-11-30",
      team: {
        ref: "mclaren",
        name: "McLaren",
      },
      car_number: 4,
      grid_position: 3,
      finish_position: 3,
      classification: "3",
      status: "Finished",
      points: 6.0,
      fastest_lap_rank: 6,
    },
    {
      session_id: 110,
      event_id: 22,
      has_data: true,
      kind: "R",
      season: 2025,
      round: 22,
      event_name: "Las Vegas Grand Prix",
      race_date: "2025-11-23",
      team: {
        ref: "mclaren",
        name: "McLaren",
      },
      car_number: 4,
      grid_position: 1,
      finish_position: 19,
      classification: "D",
      status: "Disqualified",
      points: 0.0,
      fastest_lap_rank: null,
    },
  ],
} satisfies Schema<"PaginatedDriverResultList">;

export const teams = {
  count: 3,
  next: null,
  previous: null,
  results: [
    {
      ref: "ferrari",
      name: "Ferrari",
      nationality: "Italian",
      wikipedia_url: "https://en.wikipedia.org/wiki/Scuderia_Ferrari",
      colour: "ED1131",
      season: {
        lineup: [
          {
            car_number: 16,
            driver: {
              ref: "leclerc",
              code: "LEC",
              given_name: "Charles",
              family_name: "Leclerc",
              portrait_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg/500px-Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg",
              photo_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg/500px-Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg",
            },
            media: {
              driver_image_url:
                "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/ferrari/chalec01/2025ferrarichalec01right.webp",
              car_image_url:
                "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/ferrari/2025ferraricarright.webp",
            },
          },
          {
            car_number: 44,
            driver: {
              ref: "hamilton",
              code: "HAM",
              given_name: "Lewis",
              family_name: "Hamilton",
              portrait_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg/500px-Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg",
              photo_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg/500px-Prime_Minister_Keir_Starmer_meets_Sir_Lewis_Hamilton_%2854566928382%29_%28cropped%29.jpg",
            },
            media: {
              driver_image_url:
                "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/ferrari/lewham01/2025ferrarilewham01right.webp",
              car_image_url:
                "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/ferrari/2025ferraricarright.webp",
            },
          },
        ],
        position: 4,
        points: 398.0,
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/ferrari/2025ferraricarright.webp",
      },
    },
    {
      ref: "mclaren",
      name: "McLaren",
      nationality: "British",
      wikipedia_url: "https://en.wikipedia.org/wiki/McLaren",
      colour: "F47600",
      season: {
        lineup: [
          {
            car_number: 81,
            driver: {
              ref: "piastri",
              code: "PIA",
              given_name: "Oscar",
              family_name: "Piastri",
              portrait_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
              photo_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
            },
            media: {
              driver_image_url:
                "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/mclaren/oscpia01/2025mclarenoscpia01right.webp",
              car_image_url:
                "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/mclaren/2025mclarencarright.webp",
            },
          },
          {
            car_number: 4,
            driver: {
              ref: "norris",
              code: "NOR",
              given_name: "Lando",
              family_name: "Norris",
              portrait_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
              photo_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
            },
            media: {
              driver_image_url:
                "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/mclaren/lannor01/2025mclarenlannor01right.webp",
              car_image_url:
                "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/mclaren/2025mclarencarright.webp",
            },
          },
        ],
        position: 1,
        points: 833.0,
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/mclaren/2025mclarencarright.webp",
      },
    },
    {
      ref: "red_bull",
      name: "Red Bull",
      nationality: "Austrian",
      wikipedia_url: "https://en.wikipedia.org/wiki/Red_Bull_Racing",
      colour: "4781D7",
      season: {
        lineup: [
          {
            car_number: 1,
            driver: {
              ref: "max_verstappen",
              code: "VER",
              given_name: "Max",
              family_name: "Verstappen",
              portrait_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg",
              photo_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg",
            },
            media: {
              driver_image_url:
                "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/redbullracing/maxver01/2025redbullracingmaxver01right.webp",
              car_image_url:
                "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/redbullracing/2025redbullracingcarright.webp",
            },
          },
          {
            car_number: 22,
            driver: {
              ref: "tsunoda",
              code: "TSU",
              given_name: "Yuki",
              family_name: "Tsunoda",
              portrait_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a0/Yuki_Tsunoda_at_the_Melbourne_Walk_during_the_2026_Australian_Grand_Prix_%28028A8096%29.jpg/500px-Yuki_Tsunoda_at_the_Melbourne_Walk_during_the_2026_Australian_Grand_Prix_%28028A8096%29.jpg",
              photo_url:
                "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a0/Yuki_Tsunoda_at_the_Melbourne_Walk_during_the_2026_Australian_Grand_Prix_%28028A8096%29.jpg/500px-Yuki_Tsunoda_at_the_Melbourne_Walk_during_the_2026_Australian_Grand_Prix_%28028A8096%29.jpg",
            },
            media: {
              driver_image_url:
                "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/redbullracing/yuktsu01/2025redbullracingyuktsu01right.webp",
              car_image_url:
                "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/redbullracing/2025redbullracingcarright.webp",
            },
          },
        ],
        position: 3,
        points: 451.0,
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/redbullracing/2025redbullracingcarright.webp",
      },
    },
  ],
} satisfies Schema<"PaginatedTeamListList">;

export const team = {
  team: {
    ref: "mclaren",
    name: "McLaren",
    nationality: "British",
    wikipedia_url: "https://en.wikipedia.org/wiki/McLaren",
    colour: null,
    season: null,
  },
  colour: "F47600",
  car_image_url:
    "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2026/mclaren/2026mclarencarright.webp",
  totals: {
    seasons: 26,
    first_season: 1968,
    last_season: 2026,
    starts: 396,
    wins: 110,
    podiums: 277,
    poles: 98,
    points: 3600.5,
    championships: 9,
  },
  seasons: [
    {
      year: 2026,
      drivers: [
        {
          ref: "norris",
          code: "NOR",
          given_name: "Lando",
          family_name: "Norris",
          portrait_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
          photo_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
        },
        {
          ref: "piastri",
          code: "PIA",
          given_name: "Oscar",
          family_name: "Piastri",
          portrait_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
          photo_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
        },
      ],
      starts: 13,
      wins: 0,
      podiums: 4,
      points: 169.0,
      championship_position: null,
    },
    {
      year: 2025,
      drivers: [
        {
          ref: "norris",
          code: "NOR",
          given_name: "Lando",
          family_name: "Norris",
          portrait_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
          photo_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
        },
        {
          ref: "piastri",
          code: "PIA",
          given_name: "Oscar",
          family_name: "Piastri",
          portrait_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
          photo_url:
            "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
        },
      ],
      starts: 48,
      wins: 14,
      podiums: 34,
      points: 833.0,
      championship_position: 1,
    },
  ],
} satisfies Schema<"TeamCareer">;

export const standings = {
  season: 2025,
  round: 24,
  rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  drivers: [
    {
      position: 1,
      position_text: "1",
      points: 423.0,
      wins: 7,
      driver: {
        ref: "norris",
        code: "NOR",
        given_name: "Lando",
        family_name: "Norris",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
        photo_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
      },
      team: null,
    },
    {
      position: 2,
      position_text: "2",
      points: 421.0,
      wins: 8,
      driver: {
        ref: "max_verstappen",
        code: "VER",
        given_name: "Max",
        family_name: "Verstappen",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg",
        photo_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg",
      },
      team: null,
    },
    {
      position: 3,
      position_text: "3",
      points: 410.0,
      wins: 7,
      driver: {
        ref: "piastri",
        code: "PIA",
        given_name: "Oscar",
        family_name: "Piastri",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
        photo_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
      },
      team: null,
    },
    {
      position: 4,
      position_text: "4",
      points: 319.0,
      wins: 2,
      driver: {
        ref: "russell",
        code: "RUS",
        given_name: "George",
        family_name: "Russell",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg/500px-KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg",
        photo_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg/500px-KingsLeonSilverstne040724_%2828_of_112%29_%2853838006028%29_%28cropped%29.jpg",
      },
      team: null,
    },
    {
      position: 5,
      position_text: "5",
      points: 242.0,
      wins: 0,
      driver: {
        ref: "leclerc",
        code: "LEC",
        given_name: "Charles",
        family_name: "Leclerc",
        portrait_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg/500px-Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg",
        photo_url:
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg/500px-Charles_Leclerc_at_the_2026_Cannes_Film_Festival_%28cropped%29.jpg",
      },
      team: null,
    },
  ],
  constructors: [
    {
      position: 1,
      position_text: "1",
      points: 833.0,
      wins: 14,
      driver: null,
      team: {
        ref: "mclaren",
        name: "McLaren",
      },
    },
    {
      position: 2,
      position_text: "2",
      points: 469.0,
      wins: 2,
      driver: null,
      team: {
        ref: "mercedes",
        name: "Mercedes",
      },
    },
    {
      position: 3,
      position_text: "3",
      points: 451.0,
      wins: 8,
      driver: null,
      team: {
        ref: "red_bull",
        name: "Red Bull",
      },
    },
  ],
} satisfies Schema<"Standings">;

export const progression = {
  season: 2025,
  rounds: [
    {
      round: 1,
      name: "Australian Grand Prix",
    },
    {
      round: 2,
      name: "Chinese Grand Prix",
    },
    {
      round: 3,
      name: "Japanese Grand Prix",
    },
    {
      round: 4,
      name: "Bahrain Grand Prix",
    },
    {
      round: 5,
      name: "Saudi Arabian Grand Prix",
    },
    {
      round: 6,
      name: "Miami Grand Prix",
    },
    {
      round: 7,
      name: "Emilia Romagna Grand Prix",
    },
    {
      round: 8,
      name: "Monaco Grand Prix",
    },
    {
      round: 9,
      name: "Spanish Grand Prix",
    },
    {
      round: 10,
      name: "Canadian Grand Prix",
    },
    {
      round: 11,
      name: "Austrian Grand Prix",
    },
    {
      round: 12,
      name: "British Grand Prix",
    },
    {
      round: 13,
      name: "Belgian Grand Prix",
    },
    {
      round: 14,
      name: "Hungarian Grand Prix",
    },
    {
      round: 15,
      name: "Dutch Grand Prix",
    },
    {
      round: 16,
      name: "Italian Grand Prix",
    },
    {
      round: 17,
      name: "Azerbaijan Grand Prix",
    },
    {
      round: 18,
      name: "Singapore Grand Prix",
    },
    {
      round: 19,
      name: "United States Grand Prix",
    },
    {
      round: 20,
      name: "Mexico City Grand Prix",
    },
    {
      round: 21,
      name: "São Paulo Grand Prix",
    },
    {
      round: 22,
      name: "Las Vegas Grand Prix",
    },
    {
      round: 23,
      name: "Qatar Grand Prix",
    },
    {
      round: 24,
      name: "Abu Dhabi Grand Prix",
    },
  ],
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
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg",
      },
      colour: "F47600",
      points: [
        25.0, 44.0, 62.0, 77.0, 89.0, 115.0, 133.0, 158.0, 176.0, 176.0, 201.0, 226.0, 250.0, 275.0,
        275.0, 293.0, 299.0, 314.0, 332.0, 357.0, 390.0, 390.0, 408.0, 423.0,
      ],
      positions: [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1],
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
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg/500px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg",
      },
      colour: "4781D7",
      points: [
        18.0, 36.0, 61.0, 69.0, 87.0, 99.0, 124.0, 136.0, 137.0, 155.0, 155.0, 165.0, 185.0, 187.0,
        205.0, 230.0, 255.0, 273.0, 306.0, 321.0, 341.0, 366.0, 396.0, 421.0,
      ],
      positions: [2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2],
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
          "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/500px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg",
      },
      colour: "F47600",
      points: [
        2.0, 34.0, 49.0, 74.0, 99.0, 131.0, 146.0, 161.0, 186.0, 198.0, 216.0, 234.0, 266.0, 284.0,
        309.0, 324.0, 324.0, 336.0, 346.0, 356.0, 366.0, 366.0, 392.0, 410.0,
      ],
      positions: [9, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3],
    },
  ],
  constructors: [
    {
      team: {
        ref: "mclaren",
        name: "McLaren",
      },
      colour: "F47600",
      points: [
        27.0, 78.0, 111.0, 151.0, 188.0, 246.0, 279.0, 319.0, 362.0, 374.0, 417.0, 460.0, 516.0,
        559.0, 584.0, 617.0, 623.0, 650.0, 678.0, 713.0, 756.0, 756.0, 800.0, 833.0,
      ],
      positions: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
    {
      team: {
        ref: "mercedes",
        name: "Mercedes",
      },
      colour: "00D7B6",
      points: [
        27.0, 57.0, 75.0, 93.0, 111.0, 141.0, 147.0, 147.0, 159.0, 199.0, 209.0, 210.0, 220.0,
        236.0, 248.0, 260.0, 290.0, 325.0, 341.0, 355.0, 398.0, 431.0, 459.0, 469.0,
      ],
      positions: [2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 3, 3, 3, 3, 3, 3, 2, 2, 2, 3, 2, 2, 2, 2],
    },
  ],
} satisfies Schema<"Progression">;

export const sectors = [
  {
    car_number: 63,
    best_lap_s: 79.409,
    best_sectors_s: [28.834, 28.136, 22.243],
    ideal_lap_s: 79.213,
    top_speed_kph: 312,
  },
  {
    car_number: 81,
    best_lap_s: 79.412,
    best_sectors_s: [28.557, 27.94, 22.273],
    ideal_lap_s: 78.77,
    top_speed_kph: 315,
  },
  {
    car_number: 1,
    best_lap_s: 79.576,
    best_sectors_s: [28.773, 28.166, 22.388],
    ideal_lap_s: 79.327,
    top_speed_kph: 311,
  },
  {
    car_number: 55,
    best_lap_s: 79.79,
    best_sectors_s: [28.716, 28.589, 22.395],
    ideal_lap_s: 79.7,
    top_speed_kph: 316,
  },
  {
    car_number: 4,
    best_lap_s: 79.918,
    best_sectors_s: [28.951, 28.214, 22.556],
    ideal_lap_s: 79.721,
    top_speed_kph: 307,
  },
  {
    car_number: 27,
    best_lap_s: 80.013,
    best_sectors_s: [28.77, 28.58, 22.573],
    ideal_lap_s: 79.923,
    top_speed_kph: 319,
  },
  {
    car_number: 44,
    best_lap_s: 80.022,
    best_sectors_s: [28.747, 28.419, 22.573],
    ideal_lap_s: 79.739,
    top_speed_kph: 312,
  },
  {
    car_number: 14,
    best_lap_s: 80.113,
    best_sectors_s: [29.071, 28.298, 22.559],
    ideal_lap_s: 79.928,
    top_speed_kph: 290,
  },
  {
    car_number: 16,
    best_lap_s: 80.44,
    best_sectors_s: [29.099, 28.318, 22.708],
    ideal_lap_s: 80.125,
    top_speed_kph: 305,
  },
  {
    car_number: 30,
    best_lap_s: 80.457,
    best_sectors_s: [29.094, 28.636, 22.637],
    ideal_lap_s: 80.367,
    top_speed_kph: 304,
  },
  {
    car_number: 5,
    best_lap_s: 80.705,
    best_sectors_s: [29.061, 28.649, 22.706],
    ideal_lap_s: 80.416,
    top_speed_kph: 303,
  },
  {
    car_number: 18,
    best_lap_s: 80.708,
    best_sectors_s: [29.147, 28.667, 22.699],
    ideal_lap_s: 80.513,
    top_speed_kph: 309,
  },
  {
    car_number: 12,
    best_lap_s: 80.745,
    best_sectors_s: [29.186, 28.654, 22.753],
    ideal_lap_s: 80.593,
    top_speed_kph: 312,
  },
  {
    car_number: 23,
    best_lap_s: 80.779,
    best_sectors_s: [28.863, 28.896, 22.7],
    ideal_lap_s: 80.459,
    top_speed_kph: 310,
  },
  {
    car_number: 6,
    best_lap_s: 80.802,
    best_sectors_s: [29.086, 28.686, 22.735],
    ideal_lap_s: 80.507,
    top_speed_kph: 308,
  },
  {
    car_number: 43,
    best_lap_s: 80.827,
    best_sectors_s: [29.225, 28.765, 22.776],
    ideal_lap_s: 80.766,
    top_speed_kph: 309,
  },
  {
    car_number: 22,
    best_lap_s: 81.18,
    best_sectors_s: [29.297, 28.937, 22.832],
    ideal_lap_s: 81.066,
    top_speed_kph: 312,
  },
  {
    car_number: 10,
    best_lap_s: 81.433,
    best_sectors_s: [29.272, 29.182, 22.705],
    ideal_lap_s: 81.159,
    top_speed_kph: 310,
  },
  {
    car_number: 31,
    best_lap_s: 81.916,
    best_sectors_s: [29.424, 29.236, 22.873],
    ideal_lap_s: 81.533,
    top_speed_kph: 308,
  },
  {
    car_number: 87,
    best_lap_s: 81.989,
    best_sectors_s: [29.539, 29.236, 22.838],
    ideal_lap_s: 81.613,
    top_speed_kph: 308,
  },
] satisfies Schema<"Sectors">[];
