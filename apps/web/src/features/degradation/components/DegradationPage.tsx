import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useSessionDetail } from "@/features/race-strategy/api";
import { byFinish, driverCode, driverName } from "@/features/race-strategy/entries";
import { useRequiredSessionId } from "@/features/race-strategy/useSessionId";
import { teamColour } from "@/lib/teams";
import { intListParam, useSearchParamsState } from "@/lib/useSearchParam";

import { useDegradation } from "../api";
import { CompoundSummary } from "./CompoundSummary";
import { DegradationChart, type SeriesStyle } from "./DegradationChart";
import { StintFitTable } from "./StintFitTable";

/** Drivers shown when `?cars=` is absent: the first finishers with a fitted stint. */
const DEFAULT_DRIVER_COUNT = 3;

export function DegradationPage() {
  const sessionId = useRequiredSessionId();
  const session = useSessionDetail(sessionId);
  const degradation = useDegradation(sessionId);
  const [params, update] = useSearchParamsState();

  if (degradation.isPending) return <Skeleton className="h-96" label="Fitting degradation…" />;
  if (degradation.isError)
    return <ErrorState error={degradation.error} onRetry={() => void degradation.refetch()} />;
  if (!session.data) return null;

  const fitted = new Set(degradation.data.stints.map((stint) => stint.car_number));
  const drivers = [...session.data.entries].sort(byFinish).filter((e) => fitted.has(e.car_number));
  if (drivers.length === 0)
    return (
      <EmptyState title="Not enough clean laps to fit degradation">
        Every stint was too short or neutralised.
      </EmptyState>
    );

  const requested = intListParam(params, "cars").filter((car) => fitted.has(car));
  const selected =
    requested.length > 0
      ? requested
      : drivers.slice(0, DEFAULT_DRIVER_COUNT).map((e) => e.car_number);

  const styles = new Map<number, SeriesStyle>();
  const seenTeams = new Map<string, number>();
  for (const entry of drivers) {
    const teamIndex = seenTeams.get(entry.team.ref) ?? 0;
    seenTeams.set(entry.team.ref, teamIndex + 1);
    styles.set(entry.car_number, {
      colour: teamColour(entry.team_colour),
      dashed: teamIndex > 0,
      label: driverCode(entry),
    });
  }
  const styleFor = (car: number): SeriesStyle =>
    styles.get(car) ?? { colour: teamColour(null), dashed: false, label: `#${car}` };

  const toggle = (car: number) => {
    const next = selected.includes(car) ? selected.filter((c) => c !== car) : [...selected, car];
    update({ cars: next.length > 0 ? next.join(",") : null });
  };
  const visible = degradation.data.stints.filter((stint) => selected.includes(stint.car_number));
  const { fuel } = degradation.data;

  return (
    <div className="space-y-6">
      <CompoundSummary compounds={degradation.data.compounds} />
      <Card title="Lap time against tyre age" eyebrow="Degradation">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-text-muted">Drivers</legend>
          <div className="flex flex-wrap gap-1.5">
            {drivers.map((entry) => {
              const style = styleFor(entry.car_number);
              const checked = selected.includes(entry.car_number);
              const lastSelected = checked && selected.length === 1;
              return (
                <label
                  key={entry.car_number}
                  title={driverName(entry)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition has-focus-visible:outline-2 has-focus-visible:outline-accent has-enabled:cursor-pointer ${
                    checked
                      ? "border-border-strong bg-raised text-text"
                      : "border-border text-text-muted hover:text-text"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={lastSelected}
                    onChange={() => {
                      toggle(entry.car_number);
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="h-0.5 w-3.5"
                    style={{
                      background: style.dashed
                        ? `repeating-linear-gradient(90deg, ${style.colour} 0 4px, transparent 4px 6px)`
                        : style.colour,
                      opacity: checked ? 1 : 0.5,
                    }}
                  />
                  {style.label}
                  <span className="sr-only"> ({driverName(entry)})</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="mt-4">
          {visible.length === 0 ? (
            <EmptyState title="Select at least one driver" />
          ) : (
            <DegradationChart stints={visible} styleFor={styleFor} />
          )}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Lap times are fuel-corrected: each lap of fuel burnt is worth{" "}
          {(fuel.gain_per_lap_s * 1000).toFixed(0)} ms ({fuel.seconds_per_kg.toFixed(3)} s/kg).
          Team-mates share a colour, the second one is dashed. Lap 1, pit laps, neutralised laps and
          outliers are excluded.
        </p>
        {visible.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-text-muted hover:text-text">
              Show fits as a table
            </summary>
            <StintFitTable stints={visible} labelFor={(car) => styleFor(car).label} />
          </details>
        )}
      </Card>
    </div>
  );
}
