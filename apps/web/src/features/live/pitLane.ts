import type { Schema } from "@stintline/api-types";

type Stop = Schema<"PitLaneTime">;

export function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Team averages, quickest first. */
export function teamAverages(
  stops: readonly Stop[],
  teamOf: (car: number) => { team: string; colour: string } | undefined,
): { team: string; colour: string; average: number; stops: number }[] {
  const byTeam = new Map<string, { colour: string; times: number[] }>();
  for (const stop of stops) {
    const team = teamOf(stop.number);
    if (!team) continue;
    const row = byTeam.get(team.team) ?? { colour: team.colour, times: [] };
    row.times.push(stop.pit_lane_duration_s);
    byTeam.set(team.team, row);
  }
  return [...byTeam.entries()]
    .map(([team, row]) => ({
      team,
      colour: row.colour,
      average: mean(row.times),
      stops: row.times.length,
    }))
    .sort((a, b) => a.average - b.average);
}
