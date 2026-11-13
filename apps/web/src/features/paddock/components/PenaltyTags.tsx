import type { Schema } from "@stintline/api-types";

import { useI18n } from "@/lib/i18n/context";

import { penaltyTags, type Tone } from "../penalties";

const TONES: Record<Tone, string> = {
  penalty: "bg-loss/15 text-loss border-loss/40",
  warning: "bg-t-yellow/15 text-t-yellow border-t-yellow/40",
  neutral: "bg-raised text-muted border-line",
};

/** The ruling as tags ("+5 s", "1 pt", "No further action"). Text, not colour, carries it. */
export function PenaltyTags({ ruling }: { ruling: Schema<"DecisionBrief"> }) {
  const { t, f } = useI18n();
  const tags = penaltyTags(ruling);
  if (tags.length === 0) return <span className="text-xs text-muted">{t("penalty.other")}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.key}
          className={`num rounded-md border px-1.5 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap ${TONES[tag.tone]}`}
        >
          {t(tag.key, {
            ...tag.params,
            ...(tag.params?.eur !== undefined ? { eur: f.number(Number(tag.params.eur), 0) } : {}),
          })}
        </span>
      ))}
    </span>
  );
}
