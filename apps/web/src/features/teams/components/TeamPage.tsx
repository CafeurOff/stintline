import { History } from "lucide-react";
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router";

import { ShowAll } from "@/components/hub/Collapsible";
import { DriverName } from "@/components/hub/DriverName";
import { Bust } from "@/components/dash/Bust";
import { Panel } from "@/components/dash/Panel";
import { Trails } from "@/components/glass/Trails";
import { KeyFigures } from "@/components/hub/KeyFigures";
import { SeasonBars } from "@/components/hub/SeasonBars";
import { useCollapsed } from "@/components/hub/useCollapsed";
import { CarImage } from "@/components/racing/CarImage";
import { initials } from "@/components/racing/initials";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { useTeam } from "@/lib/queries";
import { ApiError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/context";
import { nationalityCountry } from "@/lib/i18n/geo";
import { readable } from "@/lib/colour";
import { teamColour } from "@/lib/teams";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Seasons listed before "show all": a decade of history. */
const SEASONS_SHOWN = 10;

/** A constructor: who drives for it, what it has won, and every season since its first. */
export function TeamPage() {
  const { ref = "" } = useParams();
  const team = useTeam(ref);
  useDocumentTitle(team.data?.team.name);

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

  const glow = teamColour(colour);
  const place = latest?.championship_position ?? null;

  return (
    <div className="flex flex-col gap-5">
      <header
        className="glass glow @container relative overflow-hidden rounded-[24px]"
        style={{ "--glow": glow, "--glow-x": "80%", "--glow-y": "100%" } as CSSProperties}
      >
        <Trails colour={glow} className="opacity-70" />
        {place !== null && (
          <span
            aria-hidden="true"
            className="watermark num absolute top-4 right-6 hidden sm:block"
            style={{ fontSize: `${String(Math.min(28, 40 / String(place).length))}cqw` }}
          >
            {place}
          </span>
        )}
        <div className="relative flex min-h-80 flex-col gap-3 p-6 sm:p-9 lg:max-w-[50%]">
          <p className="text-sm font-semibold text-muted">
            {info.nationality && nationalityCountry(info.nationality, locale)}
            {info.nationality ? " · " : ""}
            {t("team.since", { span })}
          </p>
          <h1 className="display text-4xl leading-[0.95] sm:text-6xl">{info.name}</h1>
          {latest && (
            <p className="text-lg font-bold" style={{ color: readable(glow) }}>
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
              className="w-fit text-sm font-semibold text-muted underline hover:text-ink"
            >
              {t("driver.wikipedia")}
            </a>
          )}
        </div>
        {car && (
          <span
            aria-hidden="true"
            className="absolute right-[6%] bottom-6 hidden h-6 w-[42%] rounded-[50%] bg-black/50 blur-xl lg:block"
          />
        )}
        <CarImage
          url={car}
          className="relative h-32 w-full px-6 pb-6 lg:absolute lg:right-6 lg:bottom-8 lg:h-48 lg:w-[48%] lg:object-right lg:p-0"
        />
      </header>

      {latest && latest.drivers.length > 0 && (
        <section aria-labelledby="team-lineup" className="flex flex-col gap-4">
          <h2 id="team-lineup" className="display text-xl">
            {t("team.lineup", { year: latest.year })}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {latest.drivers.map((driver) => (
              <li key={driver.ref}>
                <Link
                  to={`/drivers/${driver.ref}`}
                  className="group glass glow relative flex h-44 items-end overflow-hidden rounded-[20px] p-5"
                  style={
                    { "--glow": glow, "--glow-x": "100%", "--glow-y": "100%" } as CSSProperties
                  }
                >
                  <span className="relative z-10">
                    <span className="block font-medium text-muted">{driver.given_name}</span>
                    <span className="display block text-3xl group-hover:underline">
                      {driver.family_name}
                    </span>
                  </span>
                  <Bust
                    url={driver.photo_url}
                    label={driver.code ?? initials(driver.given_name, driver.family_name)}
                    colour={colour}
                    className="absolute top-0 right-0 h-full w-[42%] transition-transform duration-500 group-hover:scale-[1.04]"
                  />
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

      <Panel
        id="team-seasons"
        title={t("driver.bySeason")}
        icon={<History />}
        bodyClassName="gap-4 p-4"
      >
        <p className="text-sm text-muted">{t("team.chartNote")}</p>
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
      </Panel>
    </div>
  );
}
