import type { useI18n } from "@/lib/i18n/context";

export const SESSION_KINDS = ["FP1", "FP2", "FP3", "SQ", "SPRINT", "Q", "R"] as const;

/** Translated session name ("Practice 1", "Sprint"...), or the raw kind when unknown. */
export function sessionLabel(kind: string, t: ReturnType<typeof useI18n>["t"]): string {
  const known = SESSION_KINDS.find((k) => k === kind);
  return known ? t(`session.${known}`) : kind;
}
