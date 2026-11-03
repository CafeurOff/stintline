// Recorded from the demo API (Hungarian Grand Prix 2025, session 70), trimmed.
import type { Schema } from "@stintline/api-types";

export const undercut = {
  gap_before_s: 14.535,
  gap_after_s: 11.2447,
  net_gain_s: 3.2903,
  sigma_s: 2.9576,
  p_attacker_ahead: 0.0001,
  attacker_ahead: false,
  lap_gaps: [
    {
      lap: 20,
      gap_s: 34.7348,
    },
    {
      lap: 21,
      gap_s: 12.3805,
    },
    {
      lap: 22,
      gap_s: 11.1657,
    },
    {
      lap: 23,
      gap_s: 11.2447,
    },
  ],
} satisfies Schema<"UndercutResult">;
