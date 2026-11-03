import type { Schema } from "@stintline/api-types";
import { useId } from "react";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { compoundInfo } from "@/lib/compounds";
import { useI18n } from "@/lib/i18n/context";

import { driverName, type Entry } from "../entries";
import {
  addStop,
  MAX_STOPS,
  type Plan,
  planProblem,
  planStints,
  type RaceCompound,
  samePlan,
} from "../strategy";

type Result = Schema<"StrategyResult">;

interface StrategyPanelProps {
  entry: Entry;
  totalLaps: number;
  real: Plan;
  plan: Plan;
  compounds: readonly RaceCompound[];
  submitted: boolean;
  result: Result | undefined;
  isError: boolean;
  error: unknown;
  onChange: (plan: Plan) => void;
  onSimulate: () => void;
  onWatch: () => void;
  onRetry: () => void;
}

/** Build another tyre strategy for the selected car and replay its whole race with it. */
export function StrategyPanel(props: StrategyPanelProps) {
  const { t } = useI18n();
  const { entry, plan, real, totalLaps, compounds } = props;
  const problem = planProblem(plan, totalLaps);
  const unchanged = samePlan(plan, real);
  const setStop = (index: number, change: Partial<Plan["stops"][number]>) => {
    props.onChange({
      ...plan,
      stops: plan.stops.map((stop, i) => (i === index ? { ...stop, ...change } : stop)),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl leading-tight font-bold">
          {t("whatif.question", { name: entry.driver.family_name })}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("whatif.intro")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <PlanBar label={t("whatif.real")} plan={real} totalLaps={totalLaps} />
        <PlanBar label={t("whatif.yours")} plan={plan} totalLaps={totalLaps} />
      </div>

      <CompoundPicker
        legend={t("whatif.start")}
        compounds={compounds}
        value={plan.start}
        onChange={(start) => {
          props.onChange({ ...plan, start });
        }}
      />
      {plan.stops.map((stop, index) => (
        <fieldset key={index} className="flex flex-col gap-2 rounded-xl bg-raised p-3">
          <legend className="sr-only">{t("whatif.stop", { n: index + 1 })}</legend>
          <div className="flex items-center justify-between gap-2">
            <span aria-hidden="true" className="font-bold">
              {t("whatif.stop", { n: index + 1 })}
            </span>
            <button
              type="button"
              onClick={() => {
                props.onChange({ ...plan, stops: plan.stops.filter((_, i) => i !== index) });
              }}
              className="text-sm text-muted underline underline-offset-4 hover:text-ink"
            >
              {t("whatif.remove", { n: index + 1 })}
            </button>
          </div>
          <LapStepper
            label={t("whatif.lap", { n: index + 1 })}
            value={stop.lap}
            min={2}
            max={totalLaps - 1}
            onChange={(lap) => {
              setStop(index, { lap });
            }}
          />
          <CompoundPicker
            legend={t("whatif.newTyres", { n: index + 1 })}
            compounds={compounds}
            value={stop.compound}
            onChange={(compound) => {
              setStop(index, { compound });
            }}
          />
        </fieldset>
      ))}
      {plan.stops.length < MAX_STOPS && (
        <Button
          variant="quiet"
          onClick={() => {
            const fresh = compounds.includes("HARD") ? "HARD" : (compounds[0] ?? "HARD");
            props.onChange(addStop(plan, totalLaps, fresh));
          }}
          className="self-start"
        >
          {t("whatif.add")}
        </Button>
      )}
      {problem && (
        <p role="alert" className="text-sm text-loss">
          {t(`whatif.problem.${problem}`)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button onClick={props.onSimulate} disabled={problem !== null}>
          {t("whatif.go")}
        </Button>
        {!unchanged && (
          <Button
            variant="quiet"
            onClick={() => {
              props.onChange(real);
            }}
          >
            {t("whatif.reset")}
          </Button>
        )}
      </div>

      {props.submitted &&
        (props.isError ? (
          <ErrorState error={props.error} onRetry={props.onRetry} />
        ) : !props.result ? (
          <Skeleton className="h-40" />
        ) : (
          <Outcome entry={entry} result={props.result} onWatch={props.onWatch} />
        ))}
    </div>
  );
}

function Outcome({
  entry,
  result,
  onWatch,
}: {
  entry: Entry;
  result: Result;
  onWatch: () => void;
}) {
  const { t, f } = useI18n();
  const name = entry.driver.family_name;
  const headline =
    result.position === result.real_position
      ? t("whatif.same", { name, position: f.ordinal(result.position) })
      : t(result.position < result.real_position ? "whatif.better" : "whatif.worse", {
          name,
          position: f.ordinal(result.position),
          real: f.ordinal(result.real_position),
        });
  const gain = Math.abs(result.gain_s);
  return (
    <section
      aria-label={t("whatif.result")}
      className="flex flex-col gap-3 border-t border-line pt-4"
    >
      <p className="text-lg leading-snug font-bold">{headline}</p>
      <p className="text-sm text-muted">
        {t(result.gain_s >= 0 ? "whatif.faster" : "whatif.slower", {
          gain: f.seconds(gain, 1),
          sigma: f.seconds(result.sigma_s, 1),
        })}{" "}
        {result.points !== result.real_points &&
          t("whatif.points", {
            points: f.number(result.points, 0),
            real: f.number(result.real_points, 0),
          })}
      </p>
      <ul aria-label={t("whatif.chances")} className="flex flex-col gap-1">
        {result.chances.map((chance) => (
          <li
            key={chance.position}
            className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2 text-sm"
          >
            <span className="font-semibold tabular-nums">{f.ordinal(chance.position)}</span>
            <span className="h-2 overflow-hidden rounded-full bg-raised">
              <span
                className="block h-full rounded-full bg-mark"
                style={{ width: `${String(Math.round(chance.probability * 100))}%` }}
              />
            </span>
            <span className="text-right text-muted tabular-nums">
              {f.probability(chance.probability)}
            </span>
          </li>
        ))}
      </ul>
      {result.warnings.map((warning) => (
        <p key={warning} className="text-sm text-caution">
          {warning === "two_compound_rule" || warning === "long_stint"
            ? t(`whatif.warning.${warning}`)
            : warning}
        </p>
      ))}
      <Button variant="quiet" onClick={onWatch} className="self-start">
        {t("whatif.watch", { name: driverName(entry) })}
      </Button>
    </section>
  );
}

function PlanBar({ label, plan, totalLaps }: { label: string; plan: Plan; totalLaps: number }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex h-5 gap-0.5">
        {planStints(plan, totalLaps).map((stint) => {
          const info = compoundInfo(stint.compound);
          const text = `${t(`compound.${info.key}`)} ${String(stint.from)}–${String(stint.to)}`;
          return (
            <span
              key={`${String(stint.from)}-${stint.compound}`}
              role="img"
              aria-label={text}
              title={text}
              className="flex items-center overflow-hidden rounded-sm pl-1 text-[0.7rem] font-bold text-tyre-ink"
              style={{
                backgroundColor: info.fill,
                width: `${String(((stint.to - stint.from + 1) / totalLaps) * 100)}%`,
              }}
            >
              <span aria-hidden="true">{info.letter}</span>
            </span>
          );
        })}
      </span>
    </div>
  );
}

function CompoundPicker({
  legend,
  compounds,
  value,
  onChange,
}: {
  legend: string;
  compounds: readonly RaceCompound[];
  value: RaceCompound;
  onChange: (value: RaceCompound) => void;
}) {
  const { t } = useI18n();
  const name = useId();
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="mb-1 w-full text-sm text-muted">{legend}</legend>
      {compounds.map((compound) => {
        const info = compoundInfo(compound);
        return (
          <label
            key={compound}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-sm has-checked:border-ink has-checked:bg-panel has-checked:font-bold has-focus-visible:outline-2 has-focus-visible:outline-mark"
          >
            <input
              type="radio"
              name={name}
              value={compound}
              checked={compound === value}
              onChange={() => {
                onChange(compound);
              }}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className="inline-flex size-5 items-center justify-center rounded-full text-[0.7rem] font-bold text-tyre-ink"
              style={{ backgroundColor: info.fill }}
            >
              {info.letter}
            </span>
            {t(`compound.${info.key}`)}
          </label>
        );
      })}
    </fieldset>
  );
}

function LapStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <button
        type="button"
        aria-label={t("whatif.earlier")}
        onClick={() => {
          onChange(clamp(value - 1));
        }}
        className="grid size-8 place-items-center rounded-md border border-line-strong font-bold hover:border-ink"
      >
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(clamp(Math.round(next)));
        }}
        className="w-16 rounded-md border border-line-strong bg-panel px-2 py-1 text-center font-bold tabular-nums"
      />
      <button
        type="button"
        aria-label={t("whatif.later")}
        onClick={() => {
          onChange(clamp(value + 1));
        }}
        className="grid size-8 place-items-center rounded-md border border-line-strong font-bold hover:border-ink"
      >
        +
      </button>
    </div>
  );
}
