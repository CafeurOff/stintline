import type { Schema } from "@stintline/api-types";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router";

import { ShowAll } from "@/components/hub/Collapsible";
import { History } from "lucide-react";

import { Bust } from "@/components/dash/Bust";
import { Panel } from "@/components/dash/Panel";
import { Trails } from "@/components/glass/Trails";
import { KeyFigures } from "@/components/hub/KeyFigures";
import { SeasonBars } from "@/components/hub/SeasonBars";
import { useCollapsed } from "@/components/hub/useCollapsed";
import { TeamName } from "@/components/hub/TeamName";
import { DriverPhoto } from "@/components/racing/DriverPhoto";
import { initials } from "@/components/racing/initials";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { DriverSeason } from "./DriverSeason";
import { useDriver } from "@/features/hub/api";
import { ApiError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/context";
import { nationalityCountry } from "@/lib/i18n/geo";
import { readable } from "@/lib/colour";
import { teamColour } from "@/lib/teams";
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
    <div className="flex flex-col gap-4">
      <DriverHeader career={data} />
      <KeyFigures label={t("driver.figures")} figures={figures(data, i18n)} />
      {data.totals.last_season !== null && (
        <DriverSeason
          driverRef={data.driver.ref}
          seasons={data.seasons.map((s) => s.year)}
          defaultSeason={openingSeason(data)}
          colour={data.latest_team?.colour}
        />
      )}
      {data.seasons.length > 0 && <SeasonsTable career={data} />}
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

  const glow = teamColour(colour);
  const code = driver.code ?? initials(driver.given_name, driver.family_name);

  return (
    <header
      className="glass glow @container relative overflow-hidden rounded-[24px]"
      style={{ "--glow": glow, "--glow-x": "85%", "--glow-y": "100%" } as CSSProperties}
    >
      <Trails colour={glow} className="opacity-60" />
      {number != null && (
        <span
          aria-hidden="true"
          className="watermark num absolute top-4 right-[30%] hidden sm:block"
          style={{ fontSize: `${String(Math.min(30, 42 / String(number).length))}cqw` }}
        >
          {number}
        </span>
      )}
      {official && (
        <Bust
          url={official}
          label={code}
          colour={colour}
          width={800}
          className="absolute top-0 right-0 hidden h-full w-[34%] sm:block"
          priority
        />
      )}
      <div className="relative flex min-h-80 flex-col gap-6 p-6 sm:max-w-[60%] sm:flex-row sm:items-end sm:p-9">
        {!official && (
          <figure className="flex shrink-0 flex-col gap-2">
            <DriverPhoto
              imageUrl={portrait?.image_url}
              label={code}
              colour={colour}
              className="h-52 w-40 rounded-2xl"
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
        )}
        {official && (
          // Same width as the desktop portrait: one download for both.
          <Bust
            url={official}
            label={code}
            colour={colour}
            width={800}
            className="h-72 w-full rounded-2xl sm:hidden"
            priority
          />
        )}
        <div className="min-w-0 pb-1">
          <p className="text-xl font-medium text-muted">{driver.given_name}</p>
          <h1 className="display text-5xl leading-[0.9] sm:text-7xl">{driver.family_name}</h1>
          {team && (
            <p className="mt-4 text-lg font-bold" style={{ color: readable(glow) }}>
              <TeamName team={team} colour={colour} />
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <dl className="contents">
              {driver.nationality && (
                <div className="glass flex gap-1.5 rounded-lg px-3 py-1.5">
                  <dt className="text-muted">{t("driver.nationality")}</dt>
                  <dd className="font-semibold">
                    {nationalityCountry(driver.nationality, locale)}
                  </dd>
                </div>
              )}
              {driver.date_of_birth && (
                <div className="glass flex gap-1.5 rounded-lg px-3 py-1.5">
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
                <div className="glass flex gap-1.5 rounded-lg px-3 py-1.5">
                  <dt className="text-muted">{t("driver.number")}</dt>
                  <dd className="font-semibold tabular-nums">{number}</dd>
                </div>
              )}
            </dl>
            {driver.wikipedia_url && (
              <div className="flex items-center px-1">
                <a
                  href={driver.wikipedia_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-muted underline hover:text-ink"
                >
                  {t("driver.wikipedia")}
                </a>
              </div>
            )}
          </div>
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
    <Panel
      id="driver-seasons"
      title={t("driver.bySeason")}
      icon={<History />}
      bodyClassName="gap-4 p-4"
    >
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
    </Panel>
  );
}

/** Seasons since the last one that still count as a current career. */
const ACTIVE_YEARS = 1;

/**
 * The season a profile opens on: the latest for a driver still racing, else the driver's
 * best one (highest championship place, then most points), so a legend does not open on a
 * three-race final season.
 */
function openingSeason(career: Schema<"DriverCareer">): number | null {
  const last = career.totals.last_season;
  if (last === null) return null;
  if (last >= new Date().getUTCFullYear() - ACTIVE_YEARS) return last;
  const best = [...career.seasons].sort(
    (a, b) =>
      (a.championship_position ?? 99) - (b.championship_position ?? 99) || b.points - a.points,
  )[0];
  return best?.year ?? last;
}
