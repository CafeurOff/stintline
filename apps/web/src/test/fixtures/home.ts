// The home page for the recorded session (Hungary 2025), built from the other fixtures.
import type { Schema } from "@stintline/api-types";

import { events } from "./events";
import { standings } from "./hub";
import { session } from "./session";

/** The event of the recorded session (Hungary) and the one after it (Italy). */
function eventAt(index: number): Schema<"Event"> {
  const event = events.results[index];
  if (!event) throw new Error(`no event at ${String(index)}`);
  return event;
}
const raceEventIndex = events.results.findIndex((e) => e.sessions.some((s) => s.id === session.id));
const raceEvent = eventAt(raceEventIndex);

export const homeResponse: Schema<"Home"> = {
  season: 2025,
  next_event: eventAt(raceEventIndex + 1),
  last_race: {
    session_id: session.id,
    event: raceEvent,
    has_data: true,
    podium: session.entries.slice(0, 3),
  },
  drivers: standings.drivers,
  constructors: standings.constructors,
};
