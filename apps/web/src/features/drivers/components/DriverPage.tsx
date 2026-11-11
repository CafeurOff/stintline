import type { Schema } from "@stintline/api-types";
import { Link, useParams } from "react-router";

import { ShowAll } from "@/components/hub/Collapsible";
import { KeyFigures } from "@/components/hub/KeyFigures";
import { SeasonBars } from "@/components/hub/SeasonBars";
import { useCollapsed } from "@/components/hub/useCollapsed";
import { TeamName } from "@/components/hub/TeamName";
import { DriverPhoto } from "@/components/racing/DriverPhoto";
import { initials } from "@/components/racing/initials";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { useDriver, useDriverResults } from "@/features/hub/api";
import { ApiError } from "@/lib/errors";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { nationalityCountry } from "@/lib/i18n/geo";
import { teamColour, teamTint } from "@/lib/teams";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type Career = Schema<"DriverCareer">;

/** Seasons listed before "show all". */
const SEASONS_SHOWN = 10;

export function DriverPage() {
  const { ref = "" } = useParams();
  const i18n = useI18n();
  const { t } = i18n;
  const career = useDriver(ref);
  const who = career.data?.driver;
  useDocumentTitle(who ? `${who.given_name} ${who.family_name}` : null);

  if (career.error instanceof ApiError && career.error.status === 404) return <NotFoundPage />;
  if (career.isError) {
    return <ErrorState error={career.error} onRetry={() => void career.refetch()} />;
  }
  if (!career.data) return <Skeleton className="h-[60vh]" />;
  const data = career.data;
  return (
    <div className="flex flex-col gap-10">
      <DriverHeader career={data} />
      <KeyFigures label={t("driver.figures")} figures={figures(data, i18n)} />
      {data.seasons.length > 0 && <SeasonsTable career={data} />}
      {data.totals.last_season !== null && (
        <ResultsSection driverRef={data.driver.ref} seasons={data.seasons.map((s) => s.year)} />
      )}
    </div>
  );
}

function figures(data: Career, { t, f }: Pick<ReturnType<typeof useI18n>, "t" | "f">) {
  const totals = data.totals;
  return [
    {
      label: t("driver.seasons"),
      value:
        totals.first_season === null
          ? "—"
          : totals.first_season === totals.last_season
            ? totals.first_season
            : `${totals.first_season}–${totals.last_season}`,
    },
    { label: t("driver.starts"), value: totals.starts },
    { label: t("driver.wins"), value: totals.wins },
    { label: t("driver.podiums"), value: totals.podiums },
    { label: t("driver.poles"), value: totals.poles },
    { label: t("driver.fastestLaps"), value: totals.fastest_laps ?? "—" },
    { label: t("driver.points"), value: f.number(totals.points, totals.points % 1 ? 1 : 0) },
    { label: t("driver.titles"), value: totals.championships },
  ];
}

function age(isoDate: string): number {
  const born = new Date(isoDate);
  const now = new Date();
  let years = now.getUTCFullYear() - born.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < born.getUTCMonth() ||
    (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years;
}

function DriverHeader({ career }: { career: Career }) {
  const { t, f, locale } = useI18n();
  const { driver, media, latest_team: team } = career;
  const official = media?.driver_image_url;
  const portrait = official ? null : driver.portrait;
  const number = driver.permanent_number ?? career.latest_car_number;
  const colour = team?.colour;

  return (
    <header
      className="relative overflow-hidden rounded-3xl border-t-4"
      style={{ borderTopColor: teamColour(colour), backgroundColor: teamTint(colour, 22) }}
    >
      {number != null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-6 right-4 text-[10rem] leading-none font-bold opacity-20 sm:text-[14rem]"
          style={{ color: teamColour(colour) }}
        >
          {number}
        </span>
      )}
      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:p-10">
        <figure className="flex shrink-0 flex-col gap-2">
          <DriverPhoto
            imageUrl={official ?? portrait?.image_url}
            label={driver.code ?? initials(driver.given_name, driver.family_name)}
            colour={colour}
            className="h-56 w-44 rounded-2xl"
          />
          {portrait && (
            <figcaption className="max-w-44 text-xs text-muted">
              <a
                href={portrait.file_page_url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {t("driver.photo", { artist: portrait.artist })}
              </a>
              {", "}
              {portrait.license_url ? (
                <a
                  href={portrait.license_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {portrait.license}
                </a>
              ) : (
                portrait.license
              )}
            </figcaption>
          )}
        </figure>
        <div className="min-w-0 pb-2">
          <p className="text-xl text-muted">{driver.given_name}</p>
          <h1 className="text-5xl leading-none font-bold sm:text-7xl">{driver.family_name}</h1>
          {team && (
            <p className="mt-3 text-lg">
              <TeamName team={team} colour={colour} />
            </p>
          )}
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {driver.nationality && (
              <div className="flex gap-1">
                <dt className="text-muted">{t("driver.nationality")}</dt>
                <dd className="font-semibold">{nationalityCountry(driver.nationality, locale)}</dd>
              </div>
            )}
            {driver.date_of_birth && (
              <div className="flex gap-1">
                <dt className="text-muted">{t("driver.born")}</dt>
                <dd className="font-semibold">
                  {f.date(driver.date_of_birth)}
                  {career.totals.last_season !== null &&
                    career.totals.last_season >= new Date().getUTCFullYear() - 1 &&
                    ` (${t("driver.age", { n: age(driver.date_of_birth) })})`}
                </dd>
              </div>
            )}
            {number != null && (
              <div className="flex gap-1">
                <dt className="text-muted">{t("driver.number")}</dt>
                <dd className="font-semibold tabular-nums">{number}</dd>
              </div>
            )}
            {driver.wikipedia_url && (
              <div>
                <a
                  href={driver.wikipedia_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-mark-text underline"
                >
                  {t("driver.wikipedia")}
                </a>
              </div>
            )}
          </dl>
        </div>
      </div>
    </header>
  );
}

function SeasonsTable({ career }: { career: Career }) {
  const { t, f } = useI18n();
  const max = Math.max(1, ...career.seasons.map((s) => s.points));
  const all = [...career.seasons].reverse();
  const collapsed = useCollapsed(all, SEASONS_SHOWN);
  const seasons = collapsed.shown;
  return (
    <section aria-labelledby="driver-seasons" className="flex flex-col gap-3">
      <h2 id="driver-seasons" className="text-xl font-bold">
        {t("driver.bySeason")}
      </h2>
      {all.length > 1 && (
        <SeasonBars
          colour={career.latest_team?.colour}
          label={t("driver.chartLabel", {
            name: `${career.driver.given_name} ${career.driver.family_name}`,
          })}
          seasons={all.map((s) => ({
            year: s.year,
            points: s.points,
            position: s.championship_position,
          }))}
        />
      )}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("col.season")}</th>
              <th>{t("col.team")}</th>
              <th className="num">{t("driver.starts")}</th>
              <th className="num">{t("driver.wins")}</th>
              <th className="num hidden sm:table-cell">{t("driver.podiums")}</th>
              <th className="num">{t("col.points")}</th>
              <th className="num">{t("col.championship")}</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((season) => (
              <tr key={season.year}>
                <td>
                  <Link to={`/standings/${season.year}`} className="font-semibold hover:underline">
                    {season.year}
                  </Link>
                </td>
                <td className="text-muted">{season.teams.join(", ")}</td>
                <td className="num">{season.starts}</td>
                <td className="num">{season.wins || ""}</td>
                <td className="num hidden sm:table-cell">{season.podiums || ""}</td>
                <td className="num">
                  <span className="inline-flex items-center justify-end gap-2">
                    <span
                      aria-hidden="true"
                      className="hidden h-1.5 rounded-full bg-mark sm:inline-block"
                      style={{ width: `${Math.round((season.points / max) * 64)}px` }}
                    />
                    {f.number(season.points, season.points % 1 ? 1 : 0)}
                  </span>
                </td>
                <td className="num font-bold">
                  {season.championship_position === null
                    ? "—"
                    : f.ordinal(season.championship_position)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ShowAll
        hidden={collapsed.hidden}
        open={collapsed.open}
        onToggle={() => {
          collapsed.setOpen(!collapsed.open);
        }}
      />
    </section>
  );
}

function ResultsSection({ driverRef, seasons }: { driverRef: string; seasons: number[] }) {
  const { t, f, locale } = useI18n();
  const [params, update] = useSearchParamsState();
  const latest = seasons[seasons.length - 1] ?? null;
  const fromUrl = intParam(params, "season");
  const season = fromUrl !== null && seasons.includes(fromUrl) ? fromUrl : latest;
  const results = useDriverResults(driverRef, season);

  return (
    <section aria-labelledby="driver-results" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="driver-results" className="text-xl font-bold">
          {t("driver.results")}
        </h2>
        <Select
          label={t("season.label")}
          value={season ?? ""}
          onChange={(event) => {
            update({ season: event.target.value });
          }}
        >
          {[...seasons].reverse().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
      </div>
      {results.isError ? (
        <ErrorState error={results.error} onRetry={() => void results.refetch()} />
      ) : !results.data ? (
        <Skeleton className="h-64" />
      ) : results.data.results.length === 0 ? (
        <EmptyState title={t("driver.noResults")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="num">{t("col.round")}</th>
                <th>{t("col.grandPrix")}</th>
                <th className="hidden sm:table-cell">{t("col.team")}</th>
                <th className="num hidden sm:table-cell">{t("col.grid")}</th>
                <th className="num">{t("col.position")}</th>
                <th className="num">{t("col.points")}</th>
                <th>
                  <span className="sr-only">{t("col.replay")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {results.data.results.map((result) => {
                // Jolpica gives retired cars an order too: only a numeric classification is a finish.
                const finished = /^\d+$/.test(result.classification ?? "")
                  ? result.finish_position
                  : null;
                return (
                  <tr key={result.session_id}>
                    <td className="num text-muted">{result.round}</td>
                    <td>
                      <Link to={`/events/${result.event_id}`} className="hover:underline">
                        {eventName(result.event_name, locale)}
                      </Link>
                      {result.kind === "SPRINT" && (
                        <span className="ml-2 text-xs text-muted">{t("picker.sprint")}</span>
                      )}
                      <span className="block text-xs text-muted">{f.date(result.race_date)}</span>
                    </td>
                    <td className="hidden sm:table-cell">
                      <TeamName team={result.team} />
                    </td>
                    <td className="num hidden text-muted sm:table-cell">
                      {result.grid_position === 0 ? "—" : (result.grid_position ?? "—")}
                    </td>
                    <td
                      className={`num font-bold ${finished != null && finished <= 3 ? "text-mark-text" : ""}`}
                    >
                      {finished ?? result.classification ?? "—"}
                      {finished == null && result.status && (
                        <span className="block text-xs font-normal text-muted">
                          {result.status}
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {result.points ? f.number(result.points, result.points % 1 ? 1 : 0) : ""}
                    </td>
                    <td className="text-right">
                      {result.has_data && (
                        <Link
                          to={`/sessions/${result.session_id}`}
                          className="text-sm font-semibold whitespace-nowrap text-mark-text hover:underline"
                        >
                          {t("col.replay")} →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
