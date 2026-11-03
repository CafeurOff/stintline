// Recorded from the demo API (Hungarian Grand Prix 2025, session 70), trimmed.
import type { Schema } from "@stintline/api-types";

export const pitExit = {
  car: 4,
  pit_lap: 30,
  pit_loss_s: 21.276,
  sigma_s: 2.9783,
  position_before: 1,
  expected_position: 4.6303,
  most_likely_position: 5,
  interval: [4, 5],
  distribution: [
    0.0, 0.0, 0.0045, 0.3652, 0.6257, 0.0045, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0,
  ],
  rivals: [
    {
      car: 16,
      gap_s: 4.641,
      margin_s: -16.635,
      p_pitting_car_ahead: 0.0,
    },
    {
      car: 81,
      gap_s: 6.158,
      margin_s: -15.118,
      p_pitting_car_ahead: 0.0,
    },
    {
      car: 63,
      gap_s: 14.602,
      margin_s: -6.674,
      p_pitting_car_ahead: 0.0125,
    },
    {
      car: 14,
      gap_s: 20.244,
      margin_s: -1.032,
      p_pitting_car_ahead: 0.3645,
    },
    {
      car: 5,
      gap_s: 28.617,
      margin_s: 7.341,
      p_pitting_car_ahead: 0.9931,
    },
    {
      car: 18,
      gap_s: 31.325,
      margin_s: 10.049,
      p_pitting_car_ahead: 0.9996,
    },
    {
      car: 30,
      gap_s: 33.419,
      margin_s: 12.143,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 87,
      gap_s: 45.815,
      margin_s: 24.539,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 6,
      gap_s: 46.563,
      margin_s: 25.287,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 1,
      gap_s: 47.157,
      margin_s: 25.881,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 44,
      gap_s: 48.849,
      margin_s: 27.573,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 10,
      gap_s: 49.519,
      margin_s: 28.243,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 27,
      gap_s: 50.215,
      margin_s: 28.939,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 55,
      gap_s: 50.744,
      margin_s: 29.468,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 23,
      gap_s: 51.641,
      margin_s: 30.365,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 31,
      gap_s: 52.891,
      margin_s: 31.615,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 43,
      gap_s: 54.922,
      margin_s: 33.646,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 12,
      gap_s: 55.485,
      margin_s: 34.209,
      p_pitting_car_ahead: 1.0,
    },
    {
      car: 22,
      gap_s: 58.297,
      margin_s: 37.021,
      p_pitting_car_ahead: 1.0,
    },
  ],
} satisfies Schema<"PitExitResult">;
