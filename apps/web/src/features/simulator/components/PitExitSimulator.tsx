import { useMemo } from "react";

import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { Slider } from "@/components/ui/Slider";
import { ErrorState } from "@/components/ui/States";
import { Stat } from "@/components/ui/Stat";
import { driverCode, entriesByCar, type Entry } from "@/features/race-strategy/entries";
import { formatDelta, formatPosition, formatProbability, formatSeconds } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { type PitExitRequest, usePitExit } from "../api";
import {
  carParam,
  clampedParam,
  DEFAULT_PIT_EXIT_SHARE,
  neutralisationParam,
  SIMULATION_DEBOUNCE_MS,
} from "../params";
import { DriverChip } from "./DriverChip";
import { DriverSelect } from "./DriverSelect";
import { PositionChart } from "./PositionChart";

/** Rivals whose outcome is genuinely uncertain are the ones worth showing. */
const CONTESTED_LOW = 0.02;
const CONTESTED_HIGH = 0.98;

const CONDITIONS = [
  { value: "GREEN", label: "Green flag" },
  { value: "VSC", label: "VSC" },
  { value: "SC", label: "Safety car" },
] as const;

interface PitExitSimulatorProps {
  sessionId: number;
  entries: readonly Entry[];
  totalLaps: number;
}

/** Where does a driver rejoin if they pit at the end of a given lap? */
export function PitExitSimulator({ sessionId, entries, totalLaps }: PitExitSimulatorProps) {
  const [params, update] = useSearchParamsState();
  const cars = entries.map((e) => e.car_number);
  const car = carParam(params, "car", cars, cars[0] ?? 0);
  const pitLap = clampedParam(
    params,
    "pit",
    Math.round(totalLaps * DEFAULT_PIT_EXIT_SHARE),
    2,
    totalLaps - 1,
  );
  const neutralisation = neutralisationParam(params);

  const request = useMemo<PitExitRequest>(
    () => ({ car, pit_lap: pitLap, neutralisation }),
    [car, pitLap, neutralisation],
  );
  const debounced = useDebouncedValue(request, SIMULATION_DEBOUNCE_MS);
  const result = usePitExit(sessionId, debounced);
  const byCar = entriesByCar(entries);
  const entry = byCar.get(car);
  const label = (n: number) => {
    const e = byCar.get(n);
    return e ? driverCode(e) : `#${n}`;
  };

  return (
    <Card title="Pit-exit position" eyebrow="Simulator">
      {entry && <DriverChip entry={entry} caption="Pitting car" />}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <DriverSelect
          label="Driver"
          entries={entries}
          value={car}
          onChange={(value) => {
            update({ car: value });
          }}
        />
        <SegmentedControl
          legend="Track condition"
          options={CONDITIONS}
          value={neutralisation ?? "GREEN"}
          onChange={(value) => {
            update({ neut: value === "GREEN" ? null : value });
          }}
        />
        <div className="sm:col-span-2">
          <Slider
            label="Pit at the end of lap"
            min={2}
            max={totalLaps - 1}
            value={pitLap}
            onChange={(lap) => {
              update({ pit: lap });
            }}
            display={(lap) => `Lap ${lap}`}
            valueText={(lap) => `Lap ${lap} of ${totalLaps}`}
          />
        </div>
      </div>
      <div className="mt-5" aria-live="polite">
        {result.isError ? (
          <ErrorState
            title="Simulation failed"
            error={result.error}
            onRetry={() => void result.refetch()}
          />
        ) : !result.data ? (
          <Skeleton className="h-60" label="Simulating…" />
        ) : (
          <div className={result.isFetching ? "opacity-70 transition" : "transition"}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Rejoins"
                tone="accent"
                value={formatPosition(result.data.most_likely_position)}
                hint={`90% interval ${formatPosition(result.data.interval[0])}–${formatPosition(result.data.interval[1])}`}
              />
              <Stat label="Running" value={formatPosition(result.data.position_before)} />
              <Stat label="Expected" value={result.data.expected_position.toFixed(1)} />
              <Stat
                label="Pit loss"
                value={formatSeconds(result.data.pit_loss_s)}
                hint={`± ${formatSeconds(result.data.sigma_s)} (1σ)`}
              />
            </dl>
            <div className="mt-4">
              <PositionChart
                distribution={result.data.distribution}
                interval={result.data.interval}
                mostLikely={result.data.most_likely_position}
              />
            </div>
            <ContestedRivals rivals={result.data.rivals} label={label} />
          </div>
        )}
      </div>
    </Card>
  );
}

function ContestedRivals({
  rivals,
  label,
}: {
  rivals: PitExitRivals;
  label: (car: number) => string;
}) {
  const contested = rivals.filter(
    (r) => r.p_pitting_car_ahead > CONTESTED_LOW && r.p_pitting_car_ahead < CONTESTED_HIGH,
  );
  if (contested.length === 0)
    return <p className="mt-3 text-sm text-text-muted">No close fight at the pit exit.</p>;
  return (
    <table className="mt-3 w-full text-left text-sm">
      <caption className="mb-1 text-left text-xs font-medium text-text-muted">
        Close fights at the pit exit
      </caption>
      <thead className="text-xs text-text-muted">
        <tr>
          <th scope="col" className="py-1 pr-3 font-medium">
            Rival
          </th>
          <th scope="col" className="py-1 pr-3 font-medium">
            Gap now
          </th>
          <th scope="col" className="py-1 pr-3 font-medium">
            Margin after stop
          </th>
          <th scope="col" className="py-1 font-medium">
            P(rejoin ahead)
          </th>
        </tr>
      </thead>
      <tbody className="tabular">
        {contested.map((rival) => (
          <tr key={rival.car} className="border-t border-border">
            <th scope="row" className="py-1 pr-3 font-medium">
              {label(rival.car)}
            </th>
            <td className="py-1 pr-3">{formatSeconds(rival.gap_s)}</td>
            <td className="py-1 pr-3">{formatDelta(rival.margin_s, 1)}</td>
            <td className="py-1">{formatProbability(rival.p_pitting_car_ahead)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type PitExitRivals = NonNullable<ReturnType<typeof usePitExit>["data"]>["rivals"];
