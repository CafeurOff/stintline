// Recorded from the demo API (Hungarian Grand Prix 2025, session 70), trimmed.
import type { Schema } from "@stintline/api-types";

export const session = {
  id: 70,
  kind: "R",
  starts_at: "2025-08-03T13:00:00Z",
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
    },
  },
  total_laps: 70,
  entries: [
    {
      car_number: 4,
      driver: {
        ref: "norris",
        code: "NOR",
        given_name: "Lando",
        family_name: "Norris",
        portrait_url: null,
      },
      team: {
        ref: "mclaren",
        name: "McLaren",
      },
      team_display_name: "McLaren",
      team_colour: "F47600",
      grid_position: 3,
      finish_position: 1,
      classification: "1",
      status: "Finished",
      points: 25.0,
      laps_completed: 70,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/mclaren/lannor01/2025mclarenlannor01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/mclaren/2025mclarencarright.webp",
      },
    },
    {
      car_number: 81,
      driver: {
        ref: "piastri",
        code: "PIA",
        given_name: "Oscar",
        family_name: "Piastri",
        portrait_url: null,
      },
      team: {
        ref: "mclaren",
        name: "McLaren",
      },
      team_display_name: "McLaren",
      team_colour: "F47600",
      grid_position: 2,
      finish_position: 2,
      classification: "2",
      status: "Finished",
      points: 18.0,
      laps_completed: 70,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/mclaren/oscpia01/2025mclarenoscpia01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/mclaren/2025mclarencarright.webp",
      },
    },
    {
      car_number: 63,
      driver: {
        ref: "russell",
        code: "RUS",
        given_name: "George",
        family_name: "Russell",
        portrait_url: null,
      },
      team: {
        ref: "mercedes",
        name: "Mercedes",
      },
      team_display_name: "Mercedes",
      team_colour: "00D7B6",
      grid_position: 4,
      finish_position: 3,
      classification: "3",
      status: "Finished",
      points: 15.0,
      laps_completed: 70,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/mercedes/georus01/2025mercedesgeorus01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/mercedes/2025mercedescarright.webp",
      },
    },
    {
      car_number: 16,
      driver: {
        ref: "leclerc",
        code: "LEC",
        given_name: "Charles",
        family_name: "Leclerc",
        portrait_url: null,
      },
      team: {
        ref: "ferrari",
        name: "Ferrari",
      },
      team_display_name: "Ferrari",
      team_colour: "ED1131",
      grid_position: 1,
      finish_position: 4,
      classification: "4",
      status: "Finished",
      points: 12.0,
      laps_completed: 70,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/ferrari/chalec01/2025ferrarichalec01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/ferrari/2025ferraricarright.webp",
      },
    },
    {
      car_number: 14,
      driver: {
        ref: "alonso",
        code: "ALO",
        given_name: "Fernando",
        family_name: "Alonso",
        portrait_url: null,
      },
      team: {
        ref: "aston_martin",
        name: "Aston Martin",
      },
      team_display_name: "Aston Martin",
      team_colour: "229971",
      grid_position: 5,
      finish_position: 5,
      classification: "5",
      status: "Finished",
      points: 10.0,
      laps_completed: 70,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/astonmartin/feralo01/2025astonmartinferalo01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/astonmartin/2025astonmartincarright.webp",
      },
    },
    {
      car_number: 5,
      driver: {
        ref: "bortoleto",
        code: "BOR",
        given_name: "Gabriel",
        family_name: "Bortoleto",
        portrait_url: null,
      },
      team: {
        ref: "sauber",
        name: "Sauber",
      },
      team_display_name: "Kick Sauber",
      team_colour: "01C00E",
      grid_position: 7,
      finish_position: 6,
      classification: "6",
      status: "Finished",
      points: 8.0,
      laps_completed: 70,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/kicksauber/gabbor01/2025kicksaubergabbor01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/kicksauber/2025kicksaubercarright.webp",
      },
    },
    {
      car_number: 18,
      driver: {
        ref: "stroll",
        code: "STR",
        given_name: "Lance",
        family_name: "Stroll",
        portrait_url: null,
      },
      team: {
        ref: "aston_martin",
        name: "Aston Martin",
      },
      team_display_name: "Aston Martin",
      team_colour: "229971",
      grid_position: 6,
      finish_position: 7,
      classification: "7",
      status: "Finished",
      points: 6.0,
      laps_completed: 70,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/astonmartin/lanstr01/2025astonmartinlanstr01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/astonmartin/2025astonmartincarright.webp",
      },
    },
    {
      car_number: 30,
      driver: {
        ref: "lawson",
        code: "LAW",
        given_name: "Liam",
        family_name: "Lawson",
        portrait_url: null,
      },
      team: {
        ref: "rb",
        name: "RB F1 Team",
      },
      team_display_name: "Racing Bulls",
      team_colour: "6C98FF",
      grid_position: 9,
      finish_position: 8,
      classification: "8",
      status: "Finished",
      points: 4.0,
      laps_completed: 70,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/racingbulls/lialaw01/2025racingbullslialaw01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/racingbulls/2025racingbullscarright.webp",
      },
    },
    {
      car_number: 1,
      driver: {
        ref: "max_verstappen",
        code: "VER",
        given_name: "Max",
        family_name: "Verstappen",
        portrait_url: null,
      },
      team: {
        ref: "red_bull",
        name: "Red Bull",
      },
      team_display_name: "Red Bull Racing",
      team_colour: "4781D7",
      grid_position: 8,
      finish_position: 9,
      classification: "9",
      status: "Finished",
      points: 2.0,
      laps_completed: 70,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/redbullracing/maxver01/2025redbullracingmaxver01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/redbullracing/2025redbullracingcarright.webp",
      },
    },
    {
      car_number: 12,
      driver: {
        ref: "antonelli",
        code: "ANT",
        given_name: "Andrea Kimi",
        family_name: "Antonelli",
        portrait_url: null,
      },
      team: {
        ref: "mercedes",
        name: "Mercedes",
      },
      team_display_name: "Mercedes",
      team_colour: "00D7B6",
      grid_position: 15,
      finish_position: 10,
      classification: "10",
      status: "Lapped",
      points: 1.0,
      laps_completed: 69,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/mercedes/andant01/2025mercedesandant01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/mercedes/2025mercedescarright.webp",
      },
    },
    {
      car_number: 6,
      driver: {
        ref: "hadjar",
        code: "HAD",
        given_name: "Isack",
        family_name: "Hadjar",
        portrait_url: null,
      },
      team: {
        ref: "rb",
        name: "RB F1 Team",
      },
      team_display_name: "Racing Bulls",
      team_colour: "6C98FF",
      grid_position: 10,
      finish_position: 11,
      classification: "11",
      status: "Lapped",
      points: 0.0,
      laps_completed: 69,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/racingbulls/isahad01/2025racingbullsisahad01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/racingbulls/2025racingbullscarright.webp",
      },
    },
    {
      car_number: 44,
      driver: {
        ref: "hamilton",
        code: "HAM",
        given_name: "Lewis",
        family_name: "Hamilton",
        portrait_url: null,
      },
      team: {
        ref: "ferrari",
        name: "Ferrari",
      },
      team_display_name: "Ferrari",
      team_colour: "ED1131",
      grid_position: 12,
      finish_position: 12,
      classification: "12",
      status: "Lapped",
      points: 0.0,
      laps_completed: 69,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/ferrari/lewham01/2025ferrarilewham01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/ferrari/2025ferraricarright.webp",
      },
    },
    {
      car_number: 27,
      driver: {
        ref: "hulkenberg",
        code: "HUL",
        given_name: "Nico",
        family_name: "H\u00fclkenberg",
        portrait_url: null,
      },
      team: {
        ref: "sauber",
        name: "Sauber",
      },
      team_display_name: "Kick Sauber",
      team_colour: "01C00E",
      grid_position: 18,
      finish_position: 13,
      classification: "13",
      status: "Lapped",
      points: 0.0,
      laps_completed: 69,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/kicksauber/nichul01/2025kicksaubernichul01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/kicksauber/2025kicksaubercarright.webp",
      },
    },
    {
      car_number: 55,
      driver: {
        ref: "sainz",
        code: "SAI",
        given_name: "Carlos",
        family_name: "Sainz",
        portrait_url: null,
      },
      team: {
        ref: "williams",
        name: "Williams",
      },
      team_display_name: "Williams",
      team_colour: "1868DB",
      grid_position: 13,
      finish_position: 14,
      classification: "14",
      status: "Lapped",
      points: 0.0,
      laps_completed: 69,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/williams/carsai01/2025williamscarsai01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/williams/2025williamscarright.webp",
      },
    },
    {
      car_number: 23,
      driver: {
        ref: "albon",
        code: "ALB",
        given_name: "Alexander",
        family_name: "Albon",
        portrait_url: null,
      },
      team: {
        ref: "williams",
        name: "Williams",
      },
      team_display_name: "Williams",
      team_colour: "1868DB",
      grid_position: 19,
      finish_position: 15,
      classification: "15",
      status: "Lapped",
      points: 0.0,
      laps_completed: 69,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/williams/alealb01/2025williamsalealb01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/williams/2025williamscarright.webp",
      },
    },
    {
      car_number: 31,
      driver: {
        ref: "ocon",
        code: "OCO",
        given_name: "Esteban",
        family_name: "Ocon",
        portrait_url: null,
      },
      team: {
        ref: "haas",
        name: "Haas F1 Team",
      },
      team_display_name: "Haas F1 Team",
      team_colour: "9C9FA2",
      grid_position: 17,
      finish_position: 16,
      classification: "16",
      status: "Lapped",
      points: 0.0,
      laps_completed: 69,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/haasf1team/estoco01/2025haasf1teamestoco01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/haasf1team/2025haasf1teamcarright.webp",
      },
    },
    {
      car_number: 22,
      driver: {
        ref: "tsunoda",
        code: "TSU",
        given_name: "Yuki",
        family_name: "Tsunoda",
        portrait_url: null,
      },
      team: {
        ref: "red_bull",
        name: "Red Bull",
      },
      team_display_name: "Red Bull Racing",
      team_colour: "4781D7",
      grid_position: 20,
      finish_position: 17,
      classification: "17",
      status: "Lapped",
      points: 0.0,
      laps_completed: 69,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/redbullracing/yuktsu01/2025redbullracingyuktsu01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/redbullracing/2025redbullracingcarright.webp",
      },
    },
    {
      car_number: 43,
      driver: {
        ref: "colapinto",
        code: "COL",
        given_name: "Franco",
        family_name: "Colapinto",
        portrait_url: null,
      },
      team: {
        ref: "alpine",
        name: "Alpine F1 Team",
      },
      team_display_name: "Alpine",
      team_colour: "00A1E8",
      grid_position: 14,
      finish_position: 18,
      classification: "18",
      status: "Lapped",
      points: 0.0,
      laps_completed: 69,
      media: {
        driver_image_url: null,
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/alpine/2025alpinecarright.webp",
      },
    },
    {
      car_number: 10,
      driver: {
        ref: "gasly",
        code: "GAS",
        given_name: "Pierre",
        family_name: "Gasly",
        portrait_url: null,
      },
      team: {
        ref: "alpine",
        name: "Alpine F1 Team",
      },
      team_display_name: "Alpine",
      team_colour: "00A1E8",
      grid_position: 16,
      finish_position: 19,
      classification: "19",
      status: "Lapped",
      points: 0.0,
      laps_completed: 69,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/alpine/piegas01/2025alpinepiegas01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/alpine/2025alpinecarright.webp",
      },
    },
    {
      car_number: 87,
      driver: {
        ref: "bearman",
        code: "BEA",
        given_name: "Oliver",
        family_name: "Bearman",
        portrait_url: null,
      },
      team: {
        ref: "haas",
        name: "Haas F1 Team",
      },
      team_display_name: "Haas F1 Team",
      team_colour: "9C9FA2",
      grid_position: 11,
      finish_position: 20,
      classification: "R",
      status: "Retired",
      points: 0.0,
      laps_completed: 48,
      media: {
        driver_image_url:
          "https://media.formula1.com/image/upload/c_lfill,w_320/q_auto/v1740000001/common/f1/2025/haasf1team/olibea01/2025haasf1teamolibea01right.webp",
        car_image_url:
          "https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/v1740000001/common/f1/2025/haasf1team/2025haasf1teamcarright.webp",
      },
    },
  ],
  neutralisations: [],
} satisfies Schema<"SessionDetail">;
