import { Link, useParams } from "react-router";

import { ShowAll } from "@/components/hub/Collapsible";
import { DriverName } from "@/components/hub/DriverName";
import { KeyFigures } from "@/components/hub/KeyFigures";
import { SeasonBars } from "@/components/hub/SeasonBars";
import { useCollapsed } from "@/components/hub/useCollapsed";
import { CarImage } from "@/components/racing/CarImage";
import { DriverPhoto } from "@/components/racing/DriverPhoto";
import { initials } from "@/components/racing/initials";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { useTeam } from "@/features/hub/api";
import { ApiError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/context";
import { nationalityCountry } from "@/lib/i18n/geo";
import { teamColour, teamTint } from "@/lib/teams";

/** Seasons listed before "show all": a decade of history. */
const SEASONS_SHOWN = 10;

/** A constructor: who drives for it, what it has won, and every season since its first. */
export function TeamPage() {
  const { ref = "" } = useParams();
  const team = useTeam(ref);

  if (team.error instanceof ApiError && team.error.status === 404) return <NotFoundPage />;
  if (team.isError) return <ErrorState error={team.error} onRetry={() => void team.refetch()} />;
  if (!team.data) return <Skeleton className="h-[60vh]" />;
  return <Team data={team.data} />;
}

function Team({ data }: { data: NonNullable<ReturnType<typeof useTeam>["data"]> }) {
  const { t, f, locale } = useI18n();
  const { totals, seasons, colour, car_image_url: car } = data;
  const info = data.team;
  const latest = seasons[0];
  const collapsed = useCollapsed(seasons, SEASONS_SHOWN);
  const span =
    totals.first_season === null
      ? "—"
      : totals.first_season === totals.last_season
        ? String(totals.first_season)
        : `${String(totals.first_season)}–${String(totals.last_season)}`;

  return (
    <div className="flex flex-col gap-12">
      <header
        className="relative overflow-hidden rounded-3xl border-t-4 p-6 sm:p-10"
        style={{ borderTopColor: teamColour(colour), backgroundColor: teamTint(colour, 22) }}
      >
        <div className="relative z-10 flex flex-col gap-2 lg:max-w-[55%]">
          <p className="text-muted">
            {info.nationality && nationalityCountry(info.nationality, locale)}
            {info.nationality ? " · " : ""}
            {t("team.since", { span })}
          </p>
          <h1 className="text-4xl leading-none font-bold sm:text-6xl">{info.name}</h1>
          {latest && (
            <p className="mt-2 text-lg">
              {latest.championship_position === null
                ? t("team.lastSeason", { year: latest.year })
                : t("team.lastPlace", {
                    year: latest.year,
                    place: f.ordinal(latest.championship_position),
                    points: f.number(latest.points, latest.points % 1 ? 1 : 0),
                  })}
            </p>
          )}
          {info.wikipedia_url && (
            <a
              href={info.wikipedia_url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-mark-text underline"
            >
              {t("driver.wikipedia")}
            </a>
          )}
        </div>
        <CarImage
          url={car}
          className="mt-6 h-28 w-full lg:absolute lg:right-6 lg:bottom-6 lg:mt-0 lg:h-40 lg:w-[45%] lg:object-right"
        />
      </header>

      {latest && latest.drivers.length > 0 && (
        <section aria-labelledby="team-lineup" className="flex flex-col gap-4">
          <h2 id="team-lineup" className="text-xl font-bold">
            {t("team.lineup", { year: latest.year })}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {latest.drivers.map((driver) => (
              <li key={driver.ref}>
                <Link
                  to={`/drivers/${driver.ref}`}
                  className="group flex items-center gap-4 overflow-hidden rounded-2xl bg-panel p-3 hover:bg-raised"
                >
                  <DriverPhoto
                    imageUrl={driver.portrait_url}
                    label={driver.code ?? initials(driver.given_name, driver.family_name)}
                    colour={colour}
                    className="size-20 shrink-0 rounded-xl"
                  />
                  <span>
                    <span className="block text-muted">{driver.given_name}</span>
                    <span className="block text-2xl font-bold group-hover:underline">
                      {driver.family_name}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <KeyFigures
        label={t("team.figures")}
        figures={[
          { label: t("team.starts"), value: totals.starts },
          { label: t("driver.wins"), value: totals.wins },
          { label: t("driver.podiums"), value: totals.podiums },
          { label: t("driver.poles"), value: totals.poles },
          { label: t("team.titles"), value: totals.championships },
        ]}
      />

      <section aria-labelledby="team-seasons" className="flex flex-col gap-4">
        <div>
          <h2 id="team-seasons" className="text-xl font-bold">
            {t("driver.bySeason")}
          </h2>
          <p className="text-sm text-muted">{t("team.chartNote")}</p>
        </div>
        {seasons.length > 1 && (
          <SeasonBars
            colour={colour}
            label={t("team.chartLabel", { name: info.name })}
            seasons={seasons.map((s) => ({
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
                <th>{t("team.drivers")}</th>
                <th className="num">{t("driver.wins")}</th>
                <th className="num hidden sm:table-cell">{t("driver.podiums")}</th>
                <th className="num">{t("col.points")}</th>
                <th className="num">{t("col.championship")}</th>
              </tr>
            </thead>
            <tbody>
              {collapsed.shown.map((season) => (
                <tr key={season.year}>
                  <td>
                    <Link
                      to={`/standings/${String(season.year)}?table=constructors`}
                      className="font-semibold hover:underline"
                    >
                      {season.year}
                    </Link>
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-x-4 gap-y-1">
                      {season.drivers.map((driver) => (
                        <DriverName key={driver.ref} driver={driver} colour={colour} avatar="xs" />
                      ))}
                    </span>
                  </td>
                  <td className="num">{season.wins === 0 ? "" : season.wins}</td>
                  <td className="num hidden sm:table-cell">
                    {season.podiums === 0 ? "" : season.podiums}
                  </td>
                  <td className="num">{f.number(season.points, season.points % 1 ? 1 : 0)}</td>
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
    </div>
  );
}
