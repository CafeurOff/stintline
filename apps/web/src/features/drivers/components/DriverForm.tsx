import { Activity } from "lucide-react";
import { Link } from "react-router";

import { Panel } from "@/components/layout/Panel";
import { Flag } from "@/components/racing/Flag";
import { Move } from "@/components/racing/Move";
import { ResultPosition } from "@/components/racing/ResultStatus";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { outCause } from "@/lib/results";

import { useDriverForm } from "../api";
import { type FormRace, finishOf, formSummary, placesGained } from "../form";

/** Pace gap (s/lap) that fills half the bar: teammates are rarely further apart. */
const GAP_SCALE_S = 0.5;

/**
 * The driver's last five Grands Prix across seasons: finish, grid and places gained, and the
 * fuel-corrected pace gap to the teammate, with a summary line that reads as the text
 * alternative. Not rendered for a driver without a Grand Prix.
 */
export function DriverForm({ driverRef }: { driverRef: string }) {
  const { t } = useI18n();
  const form = useDriverForm(driverRef);
  if (form.isError) {
    return (
      <Panel title={t("form.title")} icon={<Activity />}>
        <ErrorState error={form.error} onRetry={() => void form.refetch()} />
      </Panel>
    );
  }
  if (!form.data) return <Skeleton className="h-[30rem] lg:h-60" />;
  const races = form.data.races;
  if (races.length === 0) return null;
  const seasons = new Set(races.map((r) => r.season));
  return (
    <Panel
      id="driver-form"
      title={t("form.title")}
      icon={<Activity />}
      action={<p className="text-xs text-muted">{t("form.note")}</p>}
    >
      <ol
        aria-label={t("form.list")}
        className="grid grid-cols-1 border-t border-line lg:grid-cols-5 lg:gap-3 lg:border-0 lg:px-5 lg:pb-4"
      >
        {races.map((race) => (
          <FormCell
            key={race.session_id}
            race={race}
            minLaps={form.data.min_clean_laps}
            showSeason={seasons.size > 1}
          />
        ))}
      </ol>
      <Summary races={races} />
    </Panel>
  );
}

function FormCell({
  race,
  minLaps,
  showSeason,
}: {
  race: FormRace;
  minLaps: number;
  showSeason: boolean;
}) {
  const { t, locale } = useI18n();
  const finish = finishOf(race);
  const gained = placesGained(race);
  // A car can retire late and still be classified (Norris, Zandvoort 2025: P18).
  const cause =
    finish === null
      ? outCause(race.status, locale)
      : race.status === "Retired"
        ? t("result.out.R")
        : null;
  const name = eventName(race.event_name, locale);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_7.5rem] items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3 lg:grid-cols-1 lg:items-stretch lg:rounded-xl lg:border lg:px-4">
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 text-xs">
          <Flag country={race.country} />
          <span className="num shrink-0 text-muted">
            {showSeason && `${String(race.season)} · `}
            {t("form.round", { round: race.round })}
          </span>
          <Link
            to={`/events/${String(race.event_id)}`}
            title={name}
            className="truncate font-semibold hover:underline"
          >
            {name}
          </Link>
        </p>
        {cause && <p className="mt-1 truncate text-xs text-muted">{cause}</p>}
      </div>
      <div className="flex flex-col items-end gap-0.5 lg:flex-row lg:items-baseline lg:gap-2">
        <span
          className={`display num text-2xl leading-none ${finish === 1 ? "text-t-yellow" : ""}`}
        >
          {finish === null ? (
            <ResultPosition classification={race.classification} position={null} />
          ) : (
            `P${String(finish)}`
          )}
        </span>
        <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
          {race.grid_position === 0
            ? t("form.fromPitLane")
            : race.grid_position !== null && t("form.from", { grid: race.grid_position })}
          {gained !== null && <Move value={gained} />}
        </span>
      </div>
      {race.has_data && race.teammate ? (
        <PaceGap race={race} teammate={race.teammate.family_name} minLaps={minLaps} />
      ) : (
        <span aria-hidden="true" className="hidden lg:block lg:h-10" />
      )}
    </li>
  );
}

function PaceGap({
  race,
  teammate,
  minLaps,
}: {
  race: FormRace;
  teammate: string;
  minLaps: number;
}) {
  const { t, f } = useI18n();
  const gap = race.pace_gap_s;
  const share = gap === null ? 0 : Math.min(1, Math.abs(gap) / GAP_SCALE_S) * 50;
  const quicker = gap !== null && gap < 0;
  return (
    <div className="flex flex-col gap-1 lg:border-t lg:border-line lg:pt-3">
      <div className="flex flex-wrap items-baseline justify-end gap-x-2 text-xs lg:justify-between">
        <span className="text-muted">{t("form.vs", { name: teammate })}</span>
        {gap === null ? (
          <span className="num font-bold text-muted" title={t("form.noGap", { n: minLaps })}>
            —<span className="sr-only">{t("form.noGap", { n: minLaps })}</span>
          </span>
        ) : (
          <span
            className={`num text-sm font-bold ${quicker ? "text-gain" : gap > 0 ? "text-loss" : ""}`}
          >
            {f.delta(gap, 3)}
          </span>
        )}
      </div>
      <span aria-hidden="true" className="relative h-1.5 rounded-full bg-raised">
        <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
        {gap !== null && share > 0 && (
          <span
            className={`absolute inset-y-0 rounded-full ${quicker ? "bg-gain" : "bg-loss"}`}
            style={
              quicker
                ? { right: "50%", width: `${String(share)}%` }
                : { left: "50%", width: `${String(share)}%` }
            }
          />
        )}
      </span>
    </div>
  );
}

function Summary({ races }: { races: readonly FormRace[] }) {
  const { t, f } = useI18n();
  const s = formSummary(races);
  const results =
    s.wins > 0
      ? [
          t("form.wins", { n: s.wins }),
          ...(s.podiums > 0 ? [t("form.morePodiums", { n: s.podiums })] : []),
        ].join(", ")
      : s.podiums > 0
        ? t("form.podiums", { n: s.podiums })
        : t("form.noPodium");
  const averages =
    s.averageGrid === null
      ? null
      : s.averageFinish === null
        ? t("form.averageStart", { grid: f.number(s.averageGrid, 1) })
        : t("form.averages", {
            grid: f.number(s.averageGrid, 1),
            finish: f.number(s.averageFinish, 1),
          });
  const pace =
    s.averageGap === null
      ? null
      : t(s.averageGap < 0 ? "form.quicker" : "form.slower", {
          gap: f.seconds(Math.abs(s.averageGap), 3),
          name: s.teammate ?? t("form.theTeammate"),
          k: s.quicker,
          n: s.paced,
        });
  return (
    <ul className="flex flex-col gap-1 px-5 py-4 text-sm lg:flex-row lg:flex-wrap lg:gap-x-8 lg:border-t lg:border-line">
      {[results, averages, pace].map(
        (line) =>
          line && (
            <li key={line} className="num">
              {line}
            </li>
          ),
      )}
    </ul>
  );
}
