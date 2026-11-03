import { Link, useParams } from "react-router";

import { DriverName } from "@/components/hub/DriverName";
import { KeyFigures } from "@/components/hub/KeyFigures";
import { PageHeader } from "@/components/hub/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { useTeam } from "@/features/hub/api";
import { ApiError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/context";
import { nationalityCountry } from "@/lib/i18n/geo";
import { teamColour } from "@/lib/teams";

/** A constructor's record: key numbers, then every season with its drivers. */
export function TeamPage() {
  const { ref = "" } = useParams();
  const { t, f, locale } = useI18n();
  const team = useTeam(ref);

  if (team.error instanceof ApiError && team.error.status === 404) return <NotFoundPage />;
  if (team.isError) return <ErrorState error={team.error} onRetry={() => void team.refetch()} />;
  if (!team.data) return <Skeleton className="h-[60vh]" />;
  const { totals, seasons, colour } = team.data;
  const info = team.data.team;

  return (
    <div className="flex flex-col gap-10">
      <div className="border-l-4 pl-4" style={{ borderColor: teamColour(colour) }}>
        <PageHeader title={info.name}>
          {info.nationality && nationalityCountry(info.nationality, locale)}
          {info.wikipedia_url && (
            <>
              {info.nationality ? " · " : ""}
              <a
                href={info.wikipedia_url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-mark-text underline"
              >
                {t("driver.wikipedia")}
              </a>
            </>
          )}
        </PageHeader>
      </div>
      <KeyFigures
        label={t("team.figures")}
        figures={[
          {
            label: t("driver.seasons"),
            value:
              totals.first_season === null
                ? "—"
                : totals.first_season === totals.last_season
                  ? totals.first_season
                  : `${totals.first_season}–${totals.last_season}`,
          },
          { label: t("team.starts"), value: totals.starts },
          { label: t("driver.wins"), value: totals.wins },
          { label: t("driver.podiums"), value: totals.podiums },
          { label: t("driver.poles"), value: totals.poles },
          {
            label: t("driver.points"),
            value: f.number(totals.points, totals.points % 1 ? 1 : 0),
          },
          { label: t("team.titles"), value: totals.championships },
        ]}
      />
      <section aria-labelledby="team-seasons" className="flex flex-col gap-3">
        <h2 id="team-seasons" className="text-xl font-bold">
          {t("driver.bySeason")}
        </h2>
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
              {seasons.map((season) => (
                <tr key={season.year}>
                  <td>
                    <Link
                      to={`/standings/${season.year}`}
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
                  <td className="num">{season.wins || ""}</td>
                  <td className="num hidden sm:table-cell">{season.podiums || ""}</td>
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
      </section>
    </div>
  );
}
