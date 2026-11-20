import type { Schema } from "@stintline/api-types";
import { ArrowRight, History, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Panel } from "@/components/dash/Panel";
import { Term } from "@/components/ui/Term";
import { useCircuits } from "@/features/analysis/api";
import { useSessionDetail } from "@/features/race/api";
import { byFinish } from "@/features/race/entries";
import { compoundInfo } from "@/lib/compounds";
import { useI18n } from "@/lib/i18n/context";
import { outCause, outCode } from "@/lib/results";
import { teamColour } from "@/lib/teams";

type Entry = Schema<"Entry">;

/** First season with FIA documents on fia.com (ADR 0018). */
const FIA_DOCUMENTS_FROM = 2025;
/** Editions of the race shown in the preview. */
const PAST_EDITIONS = 3;

function Fact({
  tag,
  colour,
  title,
  children,
}: {
  tag: string;
  colour: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="rounded-xl bg-ink/[0.04] p-4">
      <p className="flex items-center gap-1.5 text-[0.65rem] font-bold tracking-wider uppercase">
        <span aria-hidden="true" className="h-3 w-1 rounded-full" style={{ background: colour }} />
        {tag}
      </p>
      <p className="mt-1 font-bold">{title}</p>
      {children && <p className="mt-0.5 text-sm text-muted">{children}</p>}
    </li>
  );
}

/**
 * Before the race: what the circuit asks of cars and strategists (our figures from the
 * races already run there) and how the last editions were won.
 */
export function RacePreview({ circuitRef }: { circuitRef: string }) {
  const { t, f } = useI18n();
  const profile = useCircuits().data?.find((c) => c.circuit.ref === circuitRef);
  if (!profile) return null;
  const facts: { key: string; tag: string; title: ReactNode; body?: ReactNode | undefined }[] = [];
  if (profile.pit_loss_s != null) {
    facts.push({
      key: "pit",
      tag: t("preview.tag.strategy"),
      title: (
        <>
          {f.seconds(profile.pit_loss_s, 1)} <Term id="pitLoss">{t("preview.pitLoss")}</Term>
        </>
      ),
      body:
        profile.undercut_attempts > 0
          ? t("preview.undercuts", {
              won: profile.undercut_successes,
              tried: profile.undercut_attempts,
            })
          : undefined,
    });
  }
  if (profile.degradation_s_per_lap != null) {
    facts.push({
      key: "wear",
      tag: t("preview.tag.tyres"),
      title: (
        <>
          {f.seconds(profile.degradation_s_per_lap, 3)}{" "}
          <Term id="degradation">{t("preview.wear")}</Term>
        </>
      ),
    });
  }
  if (profile.races > 0) {
    facts.push({
      key: "sc",
      tag: t("preview.tag.race"),
      title: t("preview.safetyCars", { n: profile.safety_car_races, races: profile.races }),
      body:
        profile.passes_per_race != null
          ? t("preview.passes", { n: Math.round(profile.passes_per_race) })
          : undefined,
    });
  }
  if (profile.fastest_lap_s != null && profile.fastest_lap_year != null) {
    facts.push({
      key: "record",
      tag: t("preview.tag.record"),
      title: t("preview.fastestLap", {
        time: f.lapTime(profile.fastest_lap_s),
        year: profile.fastest_lap_year,
      }),
    });
  }
  const past = [...profile.history].sort((a, b) => b.year - a.year).slice(0, PAST_EDITIONS);

  return (
    <Panel
      title={t("preview.title")}
      icon={<Sparkles />}
      action={
        <Link
          to={`/circuits/${circuitRef}`}
          className="text-sm font-semibold text-muted hover:text-ink"
        >
          {t("preview.circuit")}
        </Link>
      }
    >
      <div className="flex flex-col gap-4 p-5 pt-0">
        <p className="text-sm text-muted">{t("preview.intro", { races: profile.races })}</p>
        {facts.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {facts.map((fact) => (
              <Fact key={fact.key} tag={fact.tag} colour="var(--color-mark)" title={fact.title}>
                {fact.body}
              </Fact>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <>
            <h3 className="mt-2 flex items-center gap-2 font-bold">
              <History aria-hidden="true" className="size-4 text-muted" />
              {t("preview.history")}
            </h3>
            <ul className="flex flex-col gap-2">
              {past.map((race) => (
                <li key={race.event_id}>
                  <Link
                    to={`/events/${String(race.event_id)}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-ink/[0.04] px-4 py-3 hover:bg-ink/[0.08]"
                  >
                    <span className="num font-bold">{race.year}</span>
                    <span
                      aria-hidden="true"
                      className="h-4 w-1 rounded-full"
                      style={{ background: teamColour(race.winner_colour) }}
                    />
                    <span className="font-semibold">
                      {race.winner
                        ? `${race.winner.given_name} ${race.winner.family_name}`
                        : t("preview.noWinner")}
                    </span>
                    <span className="text-sm text-muted">
                      {race.winner_strategy
                        .map((c) => t(`compound.${compoundInfo(c).key}`))
                        .join(" → ")}
                    </span>
                    {race.wet && (
                      <span className="rounded bg-t-blue/15 px-1.5 text-xs font-bold text-t-blue">
                        {t("preview.wet")}
                      </span>
                    )}
                    {race.safety_cars > 0 && (
                      <span className="text-xs text-muted">
                        {t("preview.scCount", { n: race.safety_cars })}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}

/** The race in a few facts from its results alone (seasons without timing data). */
export function ResultFacts({ sessionId }: { sessionId: number }) {
  const { t, f, locale } = useI18n();
  const session = useSessionDetail(sessionId).data;
  if (!session) return null;
  const entries = [...session.entries].sort(byFinish);
  const [winner, second] = entries;
  if (!winner) return null;
  const name = (e: Entry) => `${e.driver.given_name} ${e.driver.family_name}`;
  const facts: {
    key: string;
    tag: string;
    colour: string;
    title: string;
    body?: string | undefined;
  }[] = [];

  facts.push({
    key: "win",
    tag: t("facts.tag.driver"),
    colour: teamColour(winner.team_colour),
    title: t("facts.win", { driver: name(winner), team: winner.team.name }),
    body:
      second?.race_time_s != null &&
      winner.race_time_s != null &&
      outCode(second.classification) === null
        ? t("facts.margin", {
            gap: f.seconds(second.race_time_s - winner.race_time_s, 3),
            second: name(second),
          })
        : undefined,
  });
  const pole = entries.find((e) => e.grid_position === 1);
  if (pole) {
    facts.push({
      key: "pole",
      tag: t("facts.tag.grid"),
      colour: teamColour(pole.team_colour),
      title:
        pole === winner
          ? t("facts.poleToWin", { driver: name(pole) })
          : t("facts.pole", { driver: name(pole), place: pole.finish_position ?? "—" }),
    });
  }
  const climbs = entries
    .filter((e) => outCode(e.classification) === null && e.grid_position && e.finish_position)
    .map((e) => ({ e, gain: (e.grid_position ?? 0) - (e.finish_position ?? 0) }))
    .sort((a, b) => b.gain - a.gain);
  const climber = climbs[0];
  if (climber && climber.gain > 0) {
    facts.push({
      key: "climb",
      tag: t("facts.tag.driver"),
      colour: teamColour(climber.e.team_colour),
      title: t("facts.climb", { driver: name(climber.e), n: climber.gain }),
      body: t("facts.climbFrom", {
        grid: climber.e.grid_position ?? 0,
        finish: climber.e.finish_position ?? 0,
      }),
    });
  }
  const out = entries.filter((e) => outCode(e.classification) !== null);
  if (out.length > 0) {
    const causes = new Map<string, number>();
    for (const e of out) {
      const cause = outCause(e.status, locale);
      if (cause) causes.set(cause, (causes.get(cause) ?? 0) + 1);
    }
    const top = [...causes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    facts.push({
      key: "out",
      tag: t("facts.tag.race"),
      colour: "var(--color-loss)",
      title: t("facts.out", { n: out.length, starters: entries.length }),
      body: top.length > 0 ? top.map(([c, n]) => `${c} (${String(n)})`).join(", ") : undefined,
    });
  }
  const finishers = entries.filter((e) => outCode(e.classification) === null);
  const leadLap = finishers.filter((e) => e.laps_completed === winner.laps_completed).length;
  if (finishers.length > 0) {
    facts.push({
      key: "lap",
      tag: t("facts.tag.race"),
      colour: "var(--color-t-yellow)",
      title: t("facts.leadLap", { n: leadLap, finishers: finishers.length }),
    });
  }

  return (
    <Panel title={t("facts.title")} icon={<Sparkles />}>
      <ul className="flex flex-col gap-3 p-5 pt-0">
        {facts.map((fact) => (
          <Fact key={fact.key} tag={fact.tag} colour={fact.colour} title={fact.title}>
            {fact.body}
          </Fact>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * Where to go next from a Grand Prix: the same race in the analysis pages, the circuit,
 * the FIA documents and the standings after this round.
 */
export function GoFurther({
  season,
  round,
  eventId,
  circuitRef,
  raceId,
  timed,
}: {
  season: number;
  round: number;
  eventId: number;
  circuitRef: string;
  raceId: number | null;
  /** Lap timing exists (2023 on): the pace and head-to-head pages have this race. */
  timed: boolean;
}) {
  const { t } = useI18n();
  const circuits = useCircuits();
  const links: [string, string][] = [];
  if (timed && raceId !== null) {
    links.push([
      `/analysis/pace?season=${String(season)}&session=${String(raceId)}`,
      t("further.pace"),
    ]);
    links.push([`/analysis?season=${String(season)}`, t("further.duels")]);
  }
  links.push([`/standings/${String(season)}?round=${String(round)}`, t("further.standings")]);
  // Track DNA exists only for circuits raced in the timing era (2023 on).
  if (circuits.data?.some((c) => c.circuit.ref === circuitRef)) {
    links.push([`/circuits/${circuitRef}`, t("further.circuit")]);
  }
  if (season >= FIA_DOCUMENTS_FROM) {
    links.push([
      `/documents?season=${String(season)}&event=${String(eventId)}`,
      t("further.documents"),
    ]);
  }
  return (
    <nav aria-label={t("further.title")} className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-muted">{t("further.title")}</span>
      {links.map(([to, label]) => (
        <Link
          key={to}
          to={to}
          className="glass flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold hover:border-line-strong"
        >
          {label}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      ))}
    </nav>
  );
}
