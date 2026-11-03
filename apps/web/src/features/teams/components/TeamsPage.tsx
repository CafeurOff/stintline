import type { Schema } from "@stintline/api-types";
import { Link } from "react-router";

import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { CarImage } from "@/components/racing/CarImage";
import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useTeams } from "@/features/hub/api";
import { useCurrentSeason } from "@/features/hub/useCurrentSeason";
import { useI18n } from "@/lib/i18n/context";
import { nationalityCountry } from "@/lib/i18n/geo";
import { teamColour, teamTint } from "@/lib/teams";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

type TeamItem = Schema<"TeamList">;

/** Teams of a season as cards (line-up, car, place), or a search across every season. */
export function TeamsPage() {
  const { t } = useI18n();
  const [params, update] = useSearchParamsState();
  const current = useCurrentSeason();
  const query = params.get("q") ?? "";
  const search = useDebouncedValue(query.trim(), 250);
  const chosen = params.get("season") === "all" ? null : intParam(params, "season");
  const season = chosen ?? (search || params.get("season") === "all" ? null : current.season);
  const teams = useTeams(search, season);
  const results = [...(teams.data?.results ?? [])].sort(
    (a, b) => (a.season?.position ?? 99) - (b.season?.position ?? 99),
  );

  return (
    <div>
      <PageHeader
        title={season === null ? t("teams.title") : t("teams.titleSeason", { year: season })}
      >
        {t("teams.intro")}
      </PageHeader>
      <div className="mb-8 flex flex-wrap items-end gap-4">
        <label className="flex min-w-64 flex-1 flex-col gap-1">
          <span className="text-sm text-muted">{t("teams.search")}</span>
          <input
            type="search"
            value={query}
            placeholder={t("teams.searchHint")}
            onChange={(event) => {
              update({ q: event.target.value || null });
            }}
            className="rounded-lg border border-line-strong bg-panel px-3 py-2 text-ink placeholder:text-muted"
          />
        </label>
        <SeasonSelect
          value={season}
          allowAll
          onChange={(value) => {
            update({ season: value ?? "all" });
          }}
        />
      </div>
      {teams.isError ? (
        <ErrorState error={teams.error} onRetry={() => void teams.refetch()} />
      ) : !teams.data ? (
        <Skeleton className="h-96" />
      ) : results.length === 0 ? (
        <EmptyState title={t("teams.empty")} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((team) => (
            <li key={team.ref}>
              {team.season ? (
                <SeasonTeamCard team={team} season={team.season} />
              ) : (
                <TeamRow team={team} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SeasonTeamCard({ team, season }: { team: TeamItem; season: Schema<"SeasonTeam"> }) {
  const { t, f } = useI18n();
  return (
    <Link
      to={`/teams/${team.ref}`}
      className="group flex h-full flex-col gap-4 rounded-2xl border-t-4 p-5 transition hover:brightness-110"
      style={{ borderTopColor: teamColour(team.colour), backgroundColor: teamTint(team.colour) }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl leading-tight font-bold group-hover:underline">{team.name}</h2>
        {season.position !== null && (
          <span className="shrink-0 text-right">
            <span className="block text-2xl leading-none font-bold tabular-nums">
              {f.ordinal(season.position)}
            </span>
            <span className="text-sm text-muted">
              {t("common.points", { n: f.number(season.points ?? 0, 0) })}
            </span>
          </span>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {season.lineup.map((entry) => (
          <li key={entry.driver.ref} className="flex items-center gap-2">
            <DriverAvatar
              label={entry.car_number}
              name={`${entry.driver.given_name} ${entry.driver.family_name}`}
              colour={team.colour}
              imageUrl={entry.media?.driver_image_url ?? entry.driver.portrait_url}
              size="sm"
              decorative
            />
            <span className="leading-tight">
              <span className="block text-xs text-muted">{entry.driver.given_name}</span>
              <span className="block font-semibold">{entry.driver.family_name}</span>
            </span>
          </li>
        ))}
      </ul>
      <CarImage url={season.car_image_url} className="mt-auto h-20 w-full object-left" />
    </Link>
  );
}

function TeamRow({ team }: { team: TeamItem }) {
  const { locale } = useI18n();
  return (
    <Link
      to={`/teams/${team.ref}`}
      className="flex items-center gap-4 rounded-xl border border-line p-4 hover:border-ink"
    >
      <span
        aria-hidden="true"
        className="h-10 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: teamColour(team.colour) }}
      />
      <span className="min-w-0">
        <span className="block truncate text-lg font-bold">{team.name}</span>
        {team.nationality && (
          <span className="block text-sm text-muted">
            {nationalityCountry(team.nationality, locale)}
          </span>
        )}
      </span>
    </Link>
  );
}
