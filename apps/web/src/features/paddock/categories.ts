import type { MessageKey } from "@/lib/i18n/en";

export const CATEGORIES = [
  "decision",
  "infringement",
  "summons",
  "classification",
  "technical",
  "notes",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_TONE: Record<Category, string> = {
  decision: "bg-mark/15 text-mark-text",
  infringement: "bg-loss/15 text-loss",
  summons: "bg-t-yellow/15 text-t-yellow",
  classification: "bg-t-purple/15 text-t-purple",
  technical: "bg-t-blue/15 text-t-blue",
  notes: "bg-raised text-ink",
  other: "bg-raised text-muted",
};

export function categoryKey(category: string): MessageKey {
  const known = CATEGORIES.find((c) => c === category) ?? "other";
  return `docs.cat.${known}`;
}
