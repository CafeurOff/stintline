// Recorded from the demo API (Hungarian Grand Prix 2025, session 70), trimmed.
import type { Schema } from "@stintline/api-types";

export const degradation = {
  compounds: [
    {
      compound: "HARD",
      slope_s_per_lap: 0.0447,
      slope_ci: [0.0403, 0.0492],
      n_laps: 646,
      n_stints: 24,
      new_tyre_pace_s: 79.7283,
      low_confidence: false,
    },
    {
      compound: "MEDIUM",
      slope_s_per_lap: 0.0469,
      slope_ci: [0.0422, 0.0517],
      n_laps: 476,
      n_stints: 21,
      new_tyre_pace_s: 80.0362,
      low_confidence: false,
    },
    {
      compound: "SOFT",
      slope_s_per_lap: 0.1009,
      slope_ci: [0.0566, 0.1452],
      n_laps: 38,
      n_stints: 3,
      new_tyre_pace_s: 80.7617,
      low_confidence: false,
    },
  ],
  stints: [
    {
      car_number: 4,
      stint: 1,
      compound: "MEDIUM",
      model: "quadratic",
      coefficients: [79.7509, -0.0598, 0.003],
      slope_s_per_lap: 0.0328,
      slope_ci: [0.0202, 0.0454],
      r_squared: 0.636,
      rmse_s: 0.2399,
      n_laps: 26,
      points: [
        {
          tyre_age: 2,
          corrected_time_s: 80.0409,
        },
        {
          tyre_age: 3,
          corrected_time_s: 79.742,
        },
        {
          tyre_age: 4,
          corrected_time_s: 79.5511,
        },
        {
          tyre_age: 5,
          corrected_time_s: 79.1403,
        },
        {
          tyre_age: 6,
          corrected_time_s: 79.2234,
        },
        {
          tyre_age: 7,
          corrected_time_s: 79.0396,
        },
        {
          tyre_age: 9,
          corrected_time_s: 79.2369,
        },
        {
          tyre_age: 10,
          corrected_time_s: 79.446,
        },
        {
          tyre_age: 11,
          corrected_time_s: 79.6461,
        },
        {
          tyre_age: 12,
          corrected_time_s: 79.9643,
        },
        {
          tyre_age: 13,
          corrected_time_s: 79.4904,
        },
        {
          tyre_age: 14,
          corrected_time_s: 79.6166,
        },
        {
          tyre_age: 15,
          corrected_time_s: 79.4737,
        },
        {
          tyre_age: 16,
          corrected_time_s: 80.0169,
        },
        {
          tyre_age: 17,
          corrected_time_s: 79.714,
        },
        {
          tyre_age: 18,
          corrected_time_s: 79.6021,
        },
        {
          tyre_age: 20,
          corrected_time_s: 79.3734,
        },
        {
          tyre_age: 21,
          corrected_time_s: 79.8126,
        },
        {
          tyre_age: 22,
          corrected_time_s: 79.8357,
        },
        {
          tyre_age: 23,
          corrected_time_s: 79.9249,
        },
        {
          tyre_age: 24,
          corrected_time_s: 79.779,
        },
        {
          tyre_age: 25,
          corrected_time_s: 80.0471,
        },
        {
          tyre_age: 26,
          corrected_time_s: 80.0743,
        },
        {
          tyre_age: 27,
          corrected_time_s: 80.1494,
        },
        {
          tyre_age: 28,
          corrected_time_s: 80.5766,
        },
        {
          tyre_age: 29,
          corrected_time_s: 80.7237,
        },
      ],
    },
    {
      car_number: 4,
      stint: 2,
      compound: "HARD",
      model: "quadratic",
      coefficients: [79.0408, -0.005, 0.0012],
      slope_s_per_lap: 0.0448,
      slope_ci: [0.0361, 0.0535],
      r_squared: 0.7736,
      rmse_s: 0.264,
      n_laps: 36,
      points: [
        {
          tyre_age: 3,
          corrected_time_s: 79.0313,
        },
        {
          tyre_age: 4,
          corrected_time_s: 79.0524,
        },
        {
          tyre_age: 5,
          corrected_time_s: 78.9306,
        },
        {
          tyre_age: 6,
          corrected_time_s: 79.3967,
        },
        {
          tyre_age: 7,
          corrected_time_s: 78.8679,
        },
        {
          tyre_age: 8,
          corrected_time_s: 78.816,
        },
        {
          tyre_age: 9,
          corrected_time_s: 79.0041,
        },
        {
          tyre_age: 10,
          corrected_time_s: 79.1563,
        },
        {
          tyre_age: 11,
          corrected_time_s: 79.1274,
        },
        {
          tyre_age: 13,
          corrected_time_s: 78.8967,
        },
        {
          tyre_age: 14,
          corrected_time_s: 79.5009,
        },
        {
          tyre_age: 15,
          corrected_time_s: 79.222,
        },
        {
          tyre_age: 16,
          corrected_time_s: 79.2501,
        },
        {
          tyre_age: 17,
          corrected_time_s: 79.4823,
        },
        {
          tyre_age: 18,
          corrected_time_s: 79.4584,
        },
        {
          tyre_age: 19,
          corrected_time_s: 79.5606,
        },
        {
          tyre_age: 20,
          corrected_time_s: 79.8597,
        },
        {
          tyre_age: 21,
          corrected_time_s: 80.0359,
        },
        {
          tyre_age: 22,
          corrected_time_s: 79.372,
        },
        {
          tyre_age: 23,
          corrected_time_s: 79.3791,
        },
        {
          tyre_age: 24,
          corrected_time_s: 79.2743,
        },
        {
          tyre_age: 25,
          corrected_time_s: 79.4694,
        },
        {
          tyre_age: 26,
          corrected_time_s: 79.2816,
        },
        {
          tyre_age: 27,
          corrected_time_s: 79.5547,
        },
        {
          tyre_age: 28,
          corrected_time_s: 79.3939,
        },
        {
          tyre_age: 29,
          corrected_time_s: 79.662,
        },
        {
          tyre_age: 30,
          corrected_time_s: 79.6621,
        },
        {
          tyre_age: 31,
          corrected_time_s: 80.0603,
        },
        {
          tyre_age: 32,
          corrected_time_s: 80.4664,
        },
        {
          tyre_age: 33,
          corrected_time_s: 80.7826,
        },
        {
          tyre_age: 34,
          corrected_time_s: 80.5057,
        },
        {
          tyre_age: 35,
          corrected_time_s: 80.3849,
        },
        {
          tyre_age: 36,
          corrected_time_s: 80.232,
        },
        {
          tyre_age: 37,
          corrected_time_s: 80.1501,
        },
        {
          tyre_age: 38,
          corrected_time_s: 80.5593,
        },
        {
          tyre_age: 39,
          corrected_time_s: 80.6904,
        },
      ],
    },
    {
      car_number: 16,
      stint: 1,
      compound: "MEDIUM",
      model: "quadratic",
      coefficients: [79.6687, -0.1684, 0.011],
      slope_s_per_lap: 0.029,
      slope_ci: [0.0141, 0.0439],
      r_squared: 0.8228,
      rmse_s: 0.1271,
      n_laps: 17,
      points: [
        {
          tyre_age: 1,
          corrected_time_s: 79.5997,
        },
        {
          tyre_age: 2,
          corrected_time_s: 79.3129,
        },
        {
          tyre_age: 3,
          corrected_time_s: 79.143,
        },
        {
          tyre_age: 4,
          corrected_time_s: 79.2301,
        },
        {
          tyre_age: 5,
          corrected_time_s: 79.3163,
        },
        {
          tyre_age: 6,
          corrected_time_s: 79.0524,
        },
        {
          tyre_age: 7,
          corrected_time_s: 78.7936,
        },
        {
          tyre_age: 8,
          corrected_time_s: 78.9227,
        },
        {
          tyre_age: 9,
          corrected_time_s: 79.0919,
        },
        {
          tyre_age: 10,
          corrected_time_s: 79.037,
        },
        {
          tyre_age: 11,
          corrected_time_s: 79.2671,
        },
        {
          tyre_age: 12,
          corrected_time_s: 79.1893,
        },
        {
          tyre_age: 13,
          corrected_time_s: 79.3144,
        },
        {
          tyre_age: 14,
          corrected_time_s: 79.4636,
        },
        {
          tyre_age: 15,
          corrected_time_s: 79.9057,
        },
        {
          tyre_age: 16,
          corrected_time_s: 79.6979,
        },
        {
          tyre_age: 17,
          corrected_time_s: 79.841,
        },
      ],
    },
    {
      car_number: 16,
      stint: 2,
      compound: "HARD",
      model: "linear",
      coefficients: [78.6029, 0.0784],
      slope_s_per_lap: 0.0784,
      slope_ci: [0.0596, 0.0972],
      r_squared: 0.8299,
      rmse_s: 0.1841,
      n_laps: 18,
      points: [
        {
          tyre_age: 2,
          corrected_time_s: 78.6686,
        },
        {
          tyre_age: 3,
          corrected_time_s: 78.6717,
        },
        {
          tyre_age: 4,
          corrected_time_s: 79.0879,
        },
        {
          tyre_age: 5,
          corrected_time_s: 79.066,
        },
        {
          tyre_age: 6,
          corrected_time_s: 79.0311,
        },
        {
          tyre_age: 7,
          corrected_time_s: 78.8533,
        },
        {
          tyre_age: 8,
          corrected_time_s: 79.1164,
        },
        {
          tyre_age: 9,
          corrected_time_s: 79.6236,
        },
        {
          tyre_age: 10,
          corrected_time_s: 79.5737,
        },
        {
          tyre_age: 11,
          corrected_time_s: 79.6759,
        },
        {
          tyre_age: 12,
          corrected_time_s: 79.746,
        },
        {
          tyre_age: 13,
          corrected_time_s: 79.6801,
        },
        {
          tyre_age: 14,
          corrected_time_s: 79.3913,
        },
        {
          tyre_age: 15,
          corrected_time_s: 79.8194,
        },
        {
          tyre_age: 16,
          corrected_time_s: 79.6756,
        },
        {
          tyre_age: 17,
          corrected_time_s: 79.6887,
        },
        {
          tyre_age: 18,
          corrected_time_s: 80.1519,
        },
        {
          tyre_age: 19,
          corrected_time_s: 80.144,
        },
      ],
    },
    {
      car_number: 16,
      stint: 3,
      compound: "HARD",
      model: "quadratic",
      coefficients: [79.2584, 0.0499, 0.0024],
      slope_s_per_lap: 0.1232,
      slope_ci: [0.1098, 0.1366],
      r_squared: 0.9431,
      rmse_s: 0.2605,
      n_laps: 25,
      points: [
        {
          tyre_age: 1,
          corrected_time_s: 79.3444,
        },
        {
          tyre_age: 2,
          corrected_time_s: 79.2516,
        },
        {
          tyre_age: 3,
          corrected_time_s: 79.3907,
        },
        {
          tyre_age: 5,
          corrected_time_s: 79.405,
        },
        {
          tyre_age: 6,
          corrected_time_s: 79.3321,
        },
        {
          tyre_age: 7,
          corrected_time_s: 79.7633,
        },
        {
          tyre_age: 8,
          corrected_time_s: 79.9314,
        },
        {
          tyre_age: 9,
          corrected_time_s: 80.6486,
        },
        {
          tyre_age: 11,
          corrected_time_s: 80.3589,
        },
        {
          tyre_age: 12,
          corrected_time_s: 80.035,
        },
        {
          tyre_age: 13,
          corrected_time_s: 80.0161,
        },
        {
          tyre_age: 14,
          corrected_time_s: 80.4363,
        },
        {
          tyre_age: 15,
          corrected_time_s: 80.6414,
        },
        {
          tyre_age: 17,
          corrected_time_s: 80.8127,
        },
        {
          tyre_age: 18,
          corrected_time_s: 80.7879,
        },
        {
          tyre_age: 19,
          corrected_time_s: 81.227,
        },
        {
          tyre_age: 20,
          corrected_time_s: 81.2701,
        },
        {
          tyre_age: 22,
          corrected_time_s: 81.3324,
        },
        {
          tyre_age: 23,
          corrected_time_s: 81.8066,
        },
        {
          tyre_age: 24,
          corrected_time_s: 81.6567,
        },
        {
          tyre_age: 25,
          corrected_time_s: 81.5859,
        },
        {
          tyre_age: 26,
          corrected_time_s: 81.68,
        },
        {
          tyre_age: 27,
          corrected_time_s: 82.5391,
        },
        {
          tyre_age: 28,
          corrected_time_s: 82.9513,
        },
        {
          tyre_age: 29,
          corrected_time_s: 82.8904,
        },
      ],
    },
    {
      car_number: 81,
      stint: 1,
      compound: "MEDIUM",
      model: "quadratic",
      coefficients: [80.3247, -0.2732, 0.0148],
      slope_s_per_lap: -0.0212,
      slope_ci: [-0.0416, -0.0007],
      r_squared: 0.7807,
      rmse_s: 0.1572,
      n_laps: 16,
      points: [
        {
          tyre_age: 1,
          corrected_time_s: 80.0127,
        },
        {
          tyre_age: 2,
          corrected_time_s: 79.9199,
        },
        {
          tyre_age: 3,
          corrected_time_s: 79.622,
        },
        {
          tyre_age: 4,
          corrected_time_s: 79.5641,
        },
        {
          tyre_age: 5,
          corrected_time_s: 79.5573,
        },
        {
          tyre_age: 6,
          corrected_time_s: 79.0404,
        },
        {
          tyre_age: 7,
          corrected_time_s: 78.9936,
        },
        {
          tyre_age: 8,
          corrected_time_s: 78.9397,
        },
        {
          tyre_age: 9,
          corrected_time_s: 78.8109,
        },
        {
          tyre_age: 10,
          corrected_time_s: 79.095,
        },
        {
          tyre_age: 11,
          corrected_time_s: 79.1811,
        },
        {
          tyre_age: 12,
          corrected_time_s: 79.5203,
        },
        {
          tyre_age: 13,
          corrected_time_s: 79.4014,
        },
        {
          tyre_age: 14,
          corrected_time_s: 79.4586,
        },
        {
          tyre_age: 15,
          corrected_time_s: 79.5687,
        },
        {
          tyre_age: 16,
          corrected_time_s: 79.5339,
        },
      ],
    },
    {
      car_number: 81,
      stint: 2,
      compound: "HARD",
      model: "quadratic",
      coefficients: [78.1937, 0.1437, -0.0031],
      slope_s_per_lap: 0.0564,
      slope_ci: [0.043, 0.0698],
      r_squared: 0.8156,
      rmse_s: 0.1924,
      n_laps: 23,
      points: [
        {
          tyre_age: 2,
          corrected_time_s: 78.6993,
        },
        {
          tyre_age: 4,
          corrected_time_s: 78.8666,
        },
        {
          tyre_age: 5,
          corrected_time_s: 78.8877,
        },
        {
          tyre_age: 6,
          corrected_time_s: 78.9369,
        },
        {
          tyre_age: 7,
          corrected_time_s: 78.753,
        },
        {
          tyre_age: 8,
          corrected_time_s: 78.9371,
        },
        {
          tyre_age: 9,
          corrected_time_s: 78.9053,
        },
        {
          tyre_age: 10,
          corrected_time_s: 79.0024,
        },
        {
          tyre_age: 11,
          corrected_time_s: 79.6356,
        },
        {
          tyre_age: 12,
          corrected_time_s: 79.4317,
        },
        {
          tyre_age: 13,
          corrected_time_s: 79.6529,
        },
        {
          tyre_age: 14,
          corrected_time_s: 79.749,
        },
        {
          tyre_age: 15,
          corrected_time_s: 79.7821,
        },
        {
          tyre_age: 16,
          corrected_time_s: 79.6883,
        },
        {
          tyre_age: 17,
          corrected_time_s: 79.8714,
        },
        {
          tyre_age: 18,
          corrected_time_s: 79.8396,
        },
        {
          tyre_age: 19,
          corrected_time_s: 79.5847,
        },
        {
          tyre_age: 20,
          corrected_time_s: 79.9639,
        },
        {
          tyre_age: 21,
          corrected_time_s: 79.956,
        },
        {
          tyre_age: 22,
          corrected_time_s: 80.1871,
        },
        {
          tyre_age: 23,
          corrected_time_s: 79.6403,
        },
        {
          tyre_age: 24,
          corrected_time_s: 79.6314,
        },
        {
          tyre_age: 25,
          corrected_time_s: 79.7276,
        },
      ],
    },
    {
      car_number: 81,
      stint: 3,
      compound: "HARD",
      model: "quadratic",
      coefficients: [78.7043, -0.0185, 0.0045],
      slope_s_per_lap: 0.0927,
      slope_ci: [0.0743, 0.1112],
      r_squared: 0.8499,
      rmse_s: 0.2814,
      n_laps: 24,
      points: [
        {
          tyre_age: 1,
          corrected_time_s: 78.5581,
        },
        {
          tyre_age: 2,
          corrected_time_s: 78.6573,
        },
        {
          tyre_age: 3,
          corrected_time_s: 78.7434,
        },
        {
          tyre_age: 4,
          corrected_time_s: 79.2366,
        },
        {
          tyre_age: 5,
          corrected_time_s: 78.5807,
        },
        {
          tyre_age: 6,
          corrected_time_s: 78.6289,
        },
        {
          tyre_age: 7,
          corrected_time_s: 78.826,
        },
        {
          tyre_age: 8,
          corrected_time_s: 79.1891,
        },
        {
          tyre_age: 9,
          corrected_time_s: 78.7133,
        },
        {
          tyre_age: 10,
          corrected_time_s: 78.7284,
        },
        {
          tyre_age: 11,
          corrected_time_s: 78.8016,
        },
        {
          tyre_age: 12,
          corrected_time_s: 78.8897,
        },
        {
          tyre_age: 13,
          corrected_time_s: 79.2109,
        },
        {
          tyre_age: 14,
          corrected_time_s: 79.033,
        },
        {
          tyre_age: 15,
          corrected_time_s: 79.2161,
        },
        {
          tyre_age: 16,
          corrected_time_s: 79.5263,
        },
        {
          tyre_age: 17,
          corrected_time_s: 79.8414,
        },
        {
          tyre_age: 18,
          corrected_time_s: 80.6246,
        },
        {
          tyre_age: 19,
          corrected_time_s: 80.2697,
        },
        {
          tyre_age: 20,
          corrected_time_s: 80.4489,
        },
        {
          tyre_age: 21,
          corrected_time_s: 80.035,
        },
        {
          tyre_age: 22,
          corrected_time_s: 80.1041,
        },
        {
          tyre_age: 23,
          corrected_time_s: 80.6503,
        },
        {
          tyre_age: 24,
          corrected_time_s: 80.6394,
        },
      ],
    },
  ],
  fuel: {
    seconds_per_kg: 0.033,
    gain_per_lap_s: 0.0471,
  },
} satisfies Schema<"Degradation">;
