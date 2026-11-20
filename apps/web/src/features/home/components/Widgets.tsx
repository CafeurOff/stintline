import type { Schema } from "@stintline/api-types";
import { Flag as FlagIcon, Siren, Timer, TrendingUp, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { IconBubble } from "@/components/layout/Glass";
import { Face } from "@/components/racing/Face";
import { readable } from "@/lib/colour";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { type Report, codeOf } from "./helpers";

function DriverChip({ entry }: { entry: Schema<"ReportEntry"> }) {
  return (
    <Link
      to={`/drivers/${entry.driver.ref}`}
      className="mt-auto flex items-center gap-2 text-sm hover:underline"
    >
      <Face
        url={entry.driver.photo_url}
        label={codeOf(entry.driver)}
        colour={entry.team_colour}
        className="size-8 shrink-0 rounded-full text-[0.6rem]"
      />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-bold">{entry.driver.family_name}</span>
        <span
          className="block truncate text-xs font-semibold"
          style={{ color: readable(teamColour(entry.team_colour)) }}
        >
          {entry.team.name}
        </span>
      </span>
    </Link>
  );
}

function Widget({
  label,
  icon,
  children,
  solid = false,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  solid?: boolean;
}) {
  const id = `widget-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section
      aria-labelledby={id}
      className={`relative flex min-h-44 flex-col gap-3 overflow-hidden rounded-[20px] p-5 ${
        solid
          ? "bg-gradient-to-br from-[#7b2cf5] to-[#3b1a9e] text-white [&_.text-muted]:text-white/75 [&_[style]]:!text-white/80"
          : "glass"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-sm font-bold">
          {label}
        </h2>
        <IconBubble>{icon}</IconBubble>
      </div>
      {children}
    </section>
  );
}

export const WIDGETS_GRID = "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4";

export function Widgets({ report }: { report: Report }) {
  const { t, f } = useI18n();
  const stop = report.pit_stops?.fastest;
  const gain = report.biggest_gain;
  const lap = report.fastest_lap;
  const n = report.neutralisations;
  const counts = [
    ["SC", n?.safety_cars ?? 0],
    ["VSC", n?.virtual_safety_cars ?? 0],
    ["RED", n?.red_flags ?? 0],
  ] as const;
  return (
    <div className={WIDGETS_GRID}>
      {stop && (
        <Widget label={t("dash.fastestStop")} icon={<Wrench />} solid>
          <p className="num display text-6xl leading-none">
            {f.number(stop.duration_s, 2)}
            <span className="ml-1 text-2xl">s</span>
          </p>
          <DriverChip entry={stop.entry} />
        </Widget>
      )}
      {gain && (
        <Widget label={t("dash.climber")} icon={<TrendingUp />}>
          <p className="flex items-baseline gap-3">
            <span className="num display text-6xl leading-none text-gain">
              +{(gain.grid_position ?? 0) - (gain.finish_position ?? 0)}
            </span>
            <span className="num text-sm font-semibold text-muted">
              {t("dash.climb", {
                grid: gain.grid_position ?? "?",
                finish: gain.finish_position ?? "?",
              })}
            </span>
          </p>
          <DriverChip entry={gain} />
        </Widget>
      )}
      {lap && (
        <Widget label={t("dash.fastestLap")} icon={<Timer />}>
          <p className="num timing text-7xl leading-none font-light text-t-purple">
            {f.lapTime(lap.fastest_lap_s)}
          </p>
          <DriverChip entry={lap} />
        </Widget>
      )}
      <Widget label={t("dash.raceControl")} icon={<Siren />}>
        <div className="flex gap-2">
          {counts.map(([label, count]) => (
            <span
              key={label}
              className={`flex flex-1 flex-col items-center rounded-xl py-2 ${
                count > 0
                  ? label === "RED"
                    ? "bg-mark text-white"
                    : "bg-t-yellow text-tyre-ink"
                  : "bg-ink/5 text-muted"
              }`}
            >
              <span className="num display text-3xl leading-none">{count}</span>
              <span className="mt-1 text-[0.65rem] font-bold">{label}</span>
            </span>
          ))}
        </div>
        <p className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-muted">
          <FlagIcon aria-hidden="true" className="size-3.5" />
          {t("dash.leadChanges", { n: report.story?.lead_changes ?? 0 })}
        </p>
      </Widget>
    </div>
  );
}
