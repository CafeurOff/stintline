import { useMemo } from "react";

import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Slider } from "@/components/ui/Slider";
import { ErrorState } from "@/components/ui/States";
import { Stat } from "@/components/ui/Stat";
import { driverCode, type Entry } from "@/features/race-strategy/entries";
import { compoundInfo, RACE_COMPOUNDS } from "@/lib/compounds";
import { formatDelta, formatProbability, formatSeconds } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { type UndercutRequest, useUndercut } from "../api";
import {
  carParam,
  clampedParam,
  compoundParam,
  DEFAULT_UNDERCUT_SHARE,
  MAX_REACTION_LAPS,
  SIMULATION_DEBOUNCE_MS,
} from "../params";
import { DriverChip } from "./DriverChip";
import { DriverSelect } from "./DriverSelect";
import { GapChart } from "./GapChart";

interface UndercutSimulatorProps {
  sessionId: number;
  entries: readonly Entry[];
  totalLaps: number;
}

/** Attacker pits first, defender reacts N laps later: who is ahead once both have stopped? */
export function UndercutSimulator({ sessionId, entries, totalLaps }: UndercutSimulatorProps) {
  const [params, update] = useSearchParamsState();
  const cars = entries.map((e) => e.car_number);
  const defender = carParam(params, "defender", cars, cars[0] ?? 0);
  const attacker = carParam(params, "attacker", cars, cars[1] ?? cars[0] ?? 0);
  const stopLap = clampedParam(
    params,
    "stop",
    Math.round(totalLaps * DEFAULT_UNDERCUT_SHARE),
    2,
    totalLaps - 1,
  );
  const reaction = clampedParam(params, "react", 1, 0, MAX_REACTION_LAPS);
  const attackerCompound = compoundParam(params, "ac", "HARD");
  const defenderCompound = compoundParam(params, "dc", "HARD");

  const request = useMemo<UndercutRequest | null>(
    () =>
      attacker === defender
        ? null
        : {
            attacker,
            defender,
            stop_lap: stopLap,
            attacker_compound: attackerCompound,
            defender_compound: defenderCompound,
            defender_reaction_laps: reaction,
          },
    [attacker, defender, stopLap, attackerCompound, defenderCompound, reaction],
  );
  const debounced = useDebouncedValue(request, SIMULATION_DEBOUNCE_MS);
  const result = useUndercut(sessionId, debounced);
  const attackerEntry = entries.find((e) => e.car_number === attacker);
  const defenderEntry = entries.find((e) => e.car_number === defender);

  return (
    <Card title="Undercut / overcut" eyebrow="Simulator">
      <div className="grid gap-3 sm:grid-cols-2">
        {attackerEntry && <DriverChip entry={attackerEntry} caption="Attacker · stops first" />}
        {defenderEntry && <DriverChip entry={defenderEntry} caption="Defender" />}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <DriverSelect
          label="Attacker"
          entries={entries}
          value={attacker}
          onChange={(car) => {
            update({ attacker: car });
          }}
        />
        <DriverSelect
          label="Defender"
          entries={entries}
          value={defender}
          onChange={(car) => {
            update({ defender: car });
          }}
        />
        <CompoundSelect
          label="Attacker's new tyres"
          value={attackerCompound}
          onChange={(value) => {
            update({ ac: value });
          }}
        />
        <CompoundSelect
          label="Defender's new tyres"
          value={defenderCompound}
          onChange={(value) => {
            update({ dc: value });
          }}
        />
        <Slider
          label="Attacker's stop lap"
          min={2}
          max={totalLaps - 1}
          value={stopLap}
          onChange={(lap) => {
            update({ stop: lap });
          }}
          display={(lap) => `Lap ${lap}`}
          valueText={(lap) => `Lap ${lap} of ${totalLaps}`}
        />
        <Slider
          label="Defender reacts after"
          min={0}
          max={MAX_REACTION_LAPS}
          value={reaction}
          onChange={(laps) => {
            update({ react: laps });
          }}
          display={(n) => `${n} ${n === 1 ? "lap" : "laps"}`}
          valueText={(n) => `${n} ${n === 1 ? "lap" : "laps"} later`}
        />
      </div>
      <div className="mt-5" aria-live="polite">
        {request === null ? (
          <p role="alert" className="text-sm text-danger">
            Pick two different drivers.
          </p>
        ) : result.isError ? (
          <ErrorState
            title="Simulation failed"
            error={result.error}
            onRetry={() => void result.refetch()}
          />
        ) : !result.data ? (
          <Skeleton className="h-60" label="Simulating…" />
        ) : (
          <div className={result.isFetching ? "opacity-70 transition" : "transition"}>
            <p className="mb-3 text-lg font-semibold">
              {result.data.attacker_ahead ? (
                <span className="text-ok">The undercut works</span>
              ) : (
                <span className="text-danger">The undercut fails</span>
              )}
              <span className="text-text-muted">
                {" "}
                · {attackerEntry ? driverCode(attackerEntry) : attacker} ahead with probability{" "}
                {formatProbability(result.data.p_attacker_ahead)}
              </span>
            </p>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Gap before" value={formatSeconds(result.data.gap_before_s)} />
              <Stat label="Gap after" value={formatSeconds(result.data.gap_after_s)} />
              <Stat
                label="Net gain"
                tone={result.data.net_gain_s > 0 ? "ok" : "danger"}
                value={formatDelta(result.data.net_gain_s, 1)}
                hint={`± ${formatSeconds(result.data.sigma_s)} (1σ)`}
              />
              <Stat
                label="P(ahead)"
                tone="accent"
                value={formatProbability(result.data.p_attacker_ahead)}
              />
            </dl>
            <div className="mt-4">
              <GapChart gaps={result.data.lap_gaps} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function CompoundSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      label={label}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      {RACE_COMPOUNDS.map((compound) => (
        <option key={compound} value={compound}>
          {compoundInfo(compound).label}
        </option>
      ))}
    </Select>
  );
}
