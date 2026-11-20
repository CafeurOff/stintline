import type { Schema } from "@stintline/api-types";
import type { CSSProperties } from "react";
import { Link } from "react-router";
import { Play } from "lucide-react";

import { AmbientTrack } from "@/components/layout/AmbientTrack";
import { pillGlass, pillPrimary } from "@/components/layout/Glass";
import { Trails } from "@/components/layout/Trails";
import { Bust } from "@/components/racing/Bust";
import { Flag } from "@/components/racing/Flag";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSessionDetail } from "@/features/race/api";
import { byFinish } from "@/features/race/entries";
import { circuitAccent } from "@/lib/accent";
import { readable } from "@/lib/colour";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import { teamColour } from "@/lib/teams";

export function EventHero({
  event,
  replays,
  raceId,
}: {
  event: Schema<"Event">;
  replays: Schema<"Event">["sessions"];
  raceId: number | null;
}) {
  const { t, f, locale } = useI18n();
  const podium = useSessionDetail(raceId ?? 0, raceId !== null);
  const top3 = [...(podium.data?.entries ?? [])]
    .sort(byFinish)
    .filter((e) => e.finish_position != null)
    .slice(0, 3);
  const accent = circuitAccent(event.circuit.ref);
  const glow = top3[0] ? teamColour(top3[0].team_colour) : accent;

  return (
    <header
      className="glass glow relative overflow-hidden rounded-[24px]"
      style={{ "--glow": glow, "--glow-x": "70%", "--glow-y": "100%" } as CSSProperties}
    >
      <Trails colour={glow} className="opacity-70" />
      <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-end xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_15rem]">
        <div className="flex flex-col gap-5 self-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Flag country={event.circuit.country} className="text-base" />
              <Link to={`/calendar/${String(event.season)}`} className="hover:underline">
                {t("event.eyebrow", { season: event.season, round: event.round })}
              </Link>
            </p>
            <h1 className="display mt-2 text-4xl leading-[0.95] sm:text-6xl">
              {eventName(event.name, locale)}
            </h1>
            <p className="mt-3 font-bold" style={{ color: readable(accent) }}>
              {event.circuit.name}
            </p>
            <p className="text-sm text-muted">
              {event.circuit.locality}, {countryName(event.circuit.country, locale)} ·{" "}
              {f.date(event.race_date)}
            </p>
          </div>
          {replays.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {replays.map((s) => (
                <Link
                  key={s.id}
                  to={`/sessions/${String(s.id)}`}
                  className={s.kind === "R" ? pillPrimary : pillGlass}
                >
                  <Play aria-hidden="true" className="size-4 fill-current" />
                  {s.kind === "R" ? t("event.replay") : t("event.replaySprint")}
                </Link>
              ))}
            </div>
          )}
        </div>
        {top3.length > 0 ? (
          <ol aria-label={t("home.podium")} className="grid grid-cols-3 items-end gap-3">
            {[1, 0, 2].map((index) => {
              const entry = top3[index];
              if (!entry) return <li key={index} />;
              const colour = teamColour(entry.team_colour);
              return (
                <li key={entry.car_number}>
                  <Link
                    to={`/drivers/${entry.driver.ref}`}
                    className="group glass glow relative flex flex-col overflow-hidden rounded-[20px]"
                    style={
                      { "--glow": colour, "--glow-x": "50%", "--glow-y": "100%" } as CSSProperties
                    }
                  >
                    <Bust
                      url={entry.media?.driver_image_url ?? entry.driver.photo_url}
                      label={entry.driver.code ?? entry.driver.family_name.slice(0, 3)}
                      colour={entry.team_colour}
                      className={`w-full transition-transform duration-500 group-hover:scale-[1.03] ${
                        index === 0 ? "h-60" : "h-48"
                      }`}
                    />
                    <span
                      aria-hidden="true"
                      className="num timing absolute top-2 left-3 text-5xl leading-none"
                    >
                      {index + 1}
                    </span>
                    <span className="relative -mt-6 flex flex-col px-2.5 pb-4 leading-tight sm:px-4">
                      <span className="display truncate text-base">
                        <span className="sm:hidden" title={entry.driver.family_name}>
                          {entry.driver.code ?? entry.driver.family_name}
                        </span>
                        <span className="hidden sm:inline">{entry.driver.family_name}</span>
                      </span>
                      <span
                        className="truncate text-xs font-bold"
                        style={{ color: readable(colour) }}
                      >
                        {entry.team.name}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : event.winner !== null && podium.isPending ? (
          // The podium's height, held while the race loads so the page below stays put.
          <Skeleton className="h-[17rem]" />
        ) : (
          <span />
        )}
        {event.circuit.outline && (
          <AmbientTrack
            path={event.circuit.outline}
            colour={accent}
            className="hidden aspect-square w-full self-center xl:block"
          />
        )}
      </div>
    </header>
  );
}
