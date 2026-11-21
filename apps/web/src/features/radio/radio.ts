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
