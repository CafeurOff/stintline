import { TrendingUp } from "lucide-react";
import { Link } from "react-router";

import { GlassCard } from "@/components/layout/Glass";
import { NO_BACKDROP } from "@/components/racing/backdrop";
import { Bust } from "@/components/racing/Bust";
import { Face } from "@/components/racing/Face";
import { useTitle } from "@/features/championship/api";
import { titleSummary } from "@/features/championship/summary";
import { TitleSentence } from "@/features/championship/TitleFight";
import { readable } from "@/lib/colour";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { type Line, codeOf, fitWidth, two } from "./helpers";

export function LeaderCard({ lines, season }: { lines: readonly Line[]; season: number | null }) {
  const { t, f } = useI18n();
  const summary = titleSummary(useTitle(season).data);
  const [first, second] = lines;
  if (!first?.driver) return null;
  const colour = teamColour(first.colour);
  const lead = (first.points ?? 0) - (second?.points ?? 0);
  const figures: [string, string][] = [
    [two(first.position ?? 1), t("home.pos")],
    [f.number(first.points ?? 0, 0), t("home.pts")],
    [two(first.wins ?? 0), t("home.wins")],
  ];
  return (
    <GlassCard
      id="home-leader"
      eyebrow={season !== null ? t("home.drivers", { season }) : undefined}
      title={t("dash.leader")}
      glow={colour}
      className="@container min-h-[460px] rounded-[24px]"
      bodyClassName="justify-end"
    >
      <span
        aria-hidden="true"
        className="watermark absolute top-2 right-4 uppercase"
        style={{ fontSize: fitWidth(codeOf(first.driver), 88) }}
      >
        {codeOf(first.driver)}
      </span>
      {/* Phones: a bust in the top corner, so the figures and the sentence stay clear. */}
      <Bust
        url={first.driver.photo_url}
        label={codeOf(first.driver)}
        colour={first.colour}
        className="absolute top-12 right-0 h-52 w-[58%] sm:hidden"
      />
      <Face
        url={first.driver.photo_url}
        label={codeOf(first.driver)}
        colour={first.colour}
        className="absolute right-0 bottom-0 hidden h-[82%] w-auto max-w-[80%] !object-contain object-bottom text-4xl sm:block"
        style={NO_BACKDROP}
      />
      <div className="relative z-10 flex flex-col gap-4 bg-gradient-to-t from-bg/80 via-bg/30 to-transparent p-6 pt-24">
        <Link
          to={`/drivers/${first.driver.ref}`}
          className="display w-fit text-3xl leading-none hover:underline"
        >
          {first.driver.given_name}
          <br />
          {first.driver.family_name}
        </Link>
        <dl className="flex gap-6">
          {figures.map(([value, label]) => (
            <div key={label} className="flex flex-col">
              <dt className="order-3 text-xs font-semibold text-muted uppercase">{label}</dt>
              <dd className="num display order-2 text-3xl" style={{ color: readable(colour) }}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="glass rounded-xl px-4 py-3 text-sm">
          {summary && summary.kind !== "open" ? (
            <TitleSentence summary={summary} />
          ) : (
            second?.driver && (
              <p className="flex items-center gap-2">
                <TrendingUp aria-hidden="true" className="size-4 text-gain" />
                {t("dash.leadBy", {
                  points: f.number(lead, 0),
                  second: second.driver.family_name,
                })}
              </p>
            )
          )}
        </div>
      </div>
    </GlassCard>
  );
}
