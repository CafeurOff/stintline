import { Link } from "react-router";

import { GlassCard, MoreLink } from "@/components/layout/Glass";
import { Face } from "@/components/racing/Face";
import { Move } from "@/components/racing/Move";
import { readable } from "@/lib/colour";
import { useI18n } from "@/lib/i18n/context";
import { useProgression, useStandings } from "@/lib/queries";
import { teamColour } from "@/lib/teams";

import { type Line, codeOf, two } from "./helpers";

/** Standings rows shown on the home page; the full tables are on the standings page. */
const STANDINGS_ROWS = 10;

/** Places won (positive) or lost since the previous round. */
function lastMove(positions: readonly (number | null)[]): number {
  const known = positions.filter((p): p is number => p !== null);
  const now = known.at(-1);
  const before = known.at(-2);
  return now === undefined || before === undefined ? 0 : before - now;
}

export function StandingsCards({ season }: { season: number }) {
  const { t } = useI18n();
  const standings = useStandings(season, null).data;
  const progression = useProgression(season).data;
  const driverMoves = new Map(
    (progression?.drivers ?? []).map((d) => [d.driver.ref, lastMove(d.positions)]),
  );
  const teamMoves = new Map(
    (progression?.constructors ?? []).map((c) => [c.team.ref, lastMove(c.positions)]),
  );
  return (
    <>
      <StandingsCard
        id="home-drivers"
        title={t("home.drivers", { season })}
        lines={standings?.drivers.slice(0, STANDINGS_ROWS) ?? []}
        moves={driverMoves}
        to={`/standings/${String(season)}`}
      />
      <StandingsCard
        id="home-teams"
        title={t("home.constructors", { season })}
        lines={standings?.constructors.slice(0, STANDINGS_ROWS) ?? []}
        moves={teamMoves}
        to={`/standings/${String(season)}?table=constructors`}
      />
    </>
  );
}

function StandingsCard({
  id,
  title,
  lines,
  moves,
  to,
}: {
  id: string;
  title: string;
  lines: readonly Line[];
  moves: Map<string, number>;
  to: string;
}) {
  const { t, f } = useI18n();
  const leader = lines[0];
  const isDrivers = Boolean(leader?.driver);
  return (
    <GlassCard
      id={id}
      title={title}
      glow={leader ? teamColour(leader.colour) : null}
      action={<MoreLink to={to}>{t("home.allStandings")}</MoreLink>}
    >
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">{t("col.position")}</th>
            <th scope="col">{isDrivers ? t("col.driver") : t("col.team")}</th>
            <th scope="col">{t("col.points")}</th>
            <th scope="col">{t("dash.evo")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const driver = line.driver;
            const ref = driver?.ref ?? line.team?.ref ?? String(index);
            const colour = teamColour(line.colour);
            return (
              <tr key={ref} className="group border-t border-line first:border-0">
                <td className="num w-12 py-3 pl-6 text-sm font-bold text-muted">
                  {line.position != null ? two(line.position) : line.position_text}
                </td>
                <td className="py-3">
                  <Link
                    to={driver ? `/drivers/${driver.ref}` : `/teams/${line.team?.ref ?? ""}`}
                    className="flex items-center gap-3"
                  >
                    {driver ? (
                      <Face
                        url={driver.photo_url}
                        label={codeOf(driver)}
                        colour={line.colour}
                        className="size-9 shrink-0 rounded-full text-[0.6rem]"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="h-8 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colour }}
                      />
                    )}
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate font-bold group-hover:underline">
                        {driver ? driver.family_name : line.team?.name}
                      </span>
                      <span
                        className="block truncate text-xs font-semibold"
                        style={{ color: readable(colour) }}
                      >
                        {driver ? (line.team?.name ?? codeOf(driver)) : t("home.wins")}
                        {!driver && ` ${String(line.wins ?? 0)}`}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="py-3 text-right whitespace-nowrap">
                  <span className="num display block text-base leading-tight">
                    {f.number(line.points ?? 0, 0)}
                  </span>
                  <span className="block text-[0.65rem] font-bold text-muted">
                    {t("home.pts").toUpperCase()}
                  </span>
                </td>
                <td className="w-16 py-3 pr-6 text-right">
                  <Move value={moves.get(ref) ?? 0} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </GlassCard>
  );
}
