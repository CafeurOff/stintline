import type { Schema } from "@stintline/api-types";

import { teamColour } from "@/lib/teams";

export interface CarStyle {
  colour: string;
  dashed: boolean;
}

/** Team colour per car; a team-mate of an earlier car is drawn dashed. */
export function carStyles(cars: readonly Schema<"TelemetryCar">[]): CarStyle[] {
  const seen = new Set<string>();
  return cars.map((car) => {
    const colour = teamColour(car.entry.team_colour);
    const dashed = seen.has(colour);
    seen.add(colour);
    return { colour, dashed };
  });
}
