import { Link } from "react-router";

import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useTeams } from "@/features/hub/api";
import { useCurrentSeason } from "@/features/hub/useCurrentSeason";
import { useI18n } from "@/lib/i18n/context";
import { nationalityCountry } from "@/lib/i18n/geo";
import { teamColour } from "@/lib/teams";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

/** Teams of a season, or a search across every constructor since 1950. */
export function TeamsPage() {
  const { t, locale } = useI18n();
  const [params, update] = useSearchParamsState();
  const current = useCurrentSeason();
  const query = params.get("q") ?? "";
  const search = useDebouncedValue(query.trim(), 250);
  const chosen = params.get("season") === "all" ? null : intParam(params, "season");
  const season = chosen ?? (search || params.get("season") === "all" ? null : current.season);
  const teams = useTeams(search, season);

  return (
    <div>
      <PageHeader title={t("teams.title")}>{t("teams.intro")}</PageHeader>
      <div className="mb-6 flex flex-wrap items-end gap-4">
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
      ) : teams.data.results.length === 0 ? (
        <EmptyState title={t("teams.empty")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.data.results.map((team) => (
            <li key={team.ref}>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
