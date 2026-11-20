import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { GlassCard, PillSwitch } from "@/components/layout/Glass";
import { FILTERS, type Tag, useFacts } from "@/features/race-facts/facts";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";

import { type Report } from "./helpers";

/** Facts shown at once in the facts card. */
const FACTS_SHOWN = 4;

const TAG_COLOUR: Record<Tag, string> = {
  driver: "var(--color-t-blue)",
  team: "var(--color-t-green)",
  race: "var(--color-t-yellow)",
};

export function FactsCard({ report }: { report: Report }) {
  const { t, f, locale } = useI18n();
  const facts = useFacts(report);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const shown = facts.filter((x) => filter === "all" || x.tag === filter).slice(0, FACTS_SHOWN);
  return (
    <GlassCard
      id="home-facts"
      title={t("dash.facts")}
      eyebrow={`${eventName(report.event.name, locale)} · ${f.date(report.event.race_date)}`}
    >
      <div className="px-6 pt-2 pb-4">
        <PillSwitch
          label={t("dash.facts")}
          value={filter}
          options={FILTERS.map((v) => [v, v === "all" ? t("dash.all") : t(`dash.tag.${v}`)])}
          onChange={setFilter}
        />
      </div>
      <ul className="flex flex-col gap-3 px-4 pb-4">
        {shown.map((fact) => (
          <li key={fact.key} className="flex flex-col gap-2 rounded-xl bg-ink/[0.04] p-4">
            <span className="flex w-fit items-center gap-1.5 text-[0.65rem] font-bold tracking-wider uppercase">
              <span
                aria-hidden="true"
                className="h-3 w-1 rounded-full"
                style={{ backgroundColor: TAG_COLOUR[fact.tag] }}
              />
              {t(`dash.tag.${fact.tag}`)}
            </span>
            <p className="leading-snug font-bold">{fact.title}</p>
            {fact.body && <p className="text-sm text-muted">{fact.body}</p>}
          </li>
        ))}
      </ul>
      <Link
        to={`/news/${String(report.session_id)}`}
        className="mt-auto flex items-center justify-center gap-2 border-t border-line py-4 text-sm font-bold hover:bg-ink/5"
      >
        {t("home.report")}
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </GlassCard>
  );
}
