import type { Schema } from "@stintline/api-types";

export type TeamRadio = Schema<"TeamRadio">;

/** Below this mean token probability a transcript is flagged as uncertain: Whisper's words
 * are then wrong often enough that the reader should check against the clip. */
export const UNCERTAIN_BELOW = 0.5;

/** "Box", "box box", "boxing": the call to pit. "Don't box" is not one. */
const BOX_CALL = /\bbox(?:ing)?\b/i;
const NOT_BOX = /\b(?:don'?t|do not|no|not)\b[^.?!,]{0,12}\bbox/i;

export function isBoxCall(transcript: string | null): boolean {
  if (!transcript) return false;
  return BOX_CALL.test(transcript) && !NOT_BOX.test(transcript);
}

export function isUncertain(radio: Pick<TeamRadio, "transcript" | "transcript_confidence">) {
  return (
    Boolean(radio.transcript) &&
    radio.transcript_confidence !== null &&
    radio.transcript_confidence < UNCERTAIN_BELOW
  );
}

/** Messages of one car, or of every car with `null`, in the order they were sent. */
export function radioOf(messages: readonly TeamRadio[], car: number | null): TeamRadio[] {
  return messages.filter((m) => car === null || m.car_number === car);
}

/** Replay seconds during which a message that just arrived is marked as new. */
export const NEW_FOR_S = 90;

/** Moment a message was sent, in seconds on the replay clock of the page. */
export type RadioMoment = (message: TeamRadio) => number;

export interface RadioFeed {
  /** Messages already sent at the replay time, most recent first. */
  heard: TeamRadio[];
  /** Messages still to come. */
  upcoming: number;
}

/** The team radio as it stood at replay time `time`: what was already said, newest first,
 * like the broadcast, without spoiling what comes later. */
export function radioFeed(
  messages: readonly TeamRadio[],
  moment: RadioMoment,
  time: number,
): RadioFeed {
  const heard = messages
    .map((message) => ({ message, at: moment(message) }))
    .filter(({ at }) => at <= time)
    .sort((a, b) => b.at - a.at)
    .map(({ message }) => message);
  return { heard, upcoming: messages.length - heard.length };
}
