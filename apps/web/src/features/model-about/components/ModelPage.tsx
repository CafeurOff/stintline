import type { Schema } from "@stintline/api-types";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Stat } from "@/components/ui/Stat";
import { formatPercent } from "@/lib/format";

import { useModelCard } from "../api";
import { type BacktestMetrics, type BacktestRaceSet, readBacktest } from "../backtest";

const SETS = [
  {
    key: "held-out",
    title: "Held-out races",
    note: "Never used for tuning: Japan, Spain, Austria, Netherlands, Mexico City, Abu Dhabi 2025.",
  },
  {
    key: "reference",
    title: "Reference races",
    note: "Used to choose the defaults: Bahrain, Hungary, Italy 2025.",
  },
] as const;

export function ModelPage() {
  const model = useModelCard();

  return (
    <div className="space-y-6 py-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold tracking-widest text-accent-text uppercase">
          About the model
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">How StintLine predicts</h1>
        <p className="mt-3 text-text-muted">
          Lap times are cleaned and fuel-corrected, each stint gets a linear or quadratic
          degradation fit, and pit loss is measured from every stop at the circuit. The pit-exit
          model treats each rival as ahead or behind with a probability from the gap, the pit loss
          and their uncertainties, and combines them into a distribution of rejoin positions. Every
          assumption below is a named parameter with a documented default.
        </p>
      </header>
      {model.isPending ? (
        <Skeleton className="h-96" label="Loading model card…" />
      ) : model.isError ? (
        <ErrorState error={model.error} onRetry={() => void model.refetch()} />
      ) : (
        <>
          <Card title="Pit-exit backtest" eyebrow={`Engine ${model.data.engine_version}`}>
            <p className="mb-4 text-sm text-text-muted">
              Every real stop is replayed: the model sees the race at the end of the in-lap and
              predicts the rejoin position. <strong className="text-text">Blind</strong> assumes
              rivals stay out; <strong className="text-text">scenario</strong> is told which rivals
              stop in the same window. The baseline assumes the driver keeps their position.
            </p>
            <div className="space-y-6">
              {SETS.map((set) => (
                <BacktestSet
                  key={set.key}
                  title={set.title}
                  note={set.note}
                  data={readBacktest(model.data.backtest, set.key)}
                />
              ))}
            </div>
          </Card>
          <Card title="Assumptions" eyebrow="Parameters">
            <AssumptionTable assumptions={model.data.assumptions} />
          </Card>
        </>
      )}
    </div>
  );
}

function BacktestSet({
  title,
  note,
  data,
}: {
  title: string;
  note: string;
  data: BacktestRaceSet | null;
}) {
  return (
    <section aria-label={title}>
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-3 text-xs text-text-muted">{note}</p>
      {!data?.blind ? (
        <EmptyState title="Backtest results not available" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Mean error"
              tone="accent"
              value={`${data.blind.overall.mae.toFixed(2)} pos`}
              hint={`baseline ${data.blind.overall.baseline_mae.toFixed(2)}`}
            />
            <Stat label="Exact" value={formatPercent(data.blind.overall.exact_rate)} />
            <Stat label="Within ±1" value={formatPercent(data.blind.overall.within_one_rate)} />
            <Stat
              label="90% interval hit"
              value={formatPercent(data.blind.overall.interval_coverage)}
              hint={`${data.blind.overall.n} stops`}
            />
          </dl>
          <MetricsTable data={data} />
        </>
      )}
    </section>
  );
}

function MetricsTable({ data }: { data: BacktestRaceSet }) {
  const rows: [string, string, BacktestMetrics][] = [];
  for (const [mode, label] of [
    ["blind", "Blind"],
    ["scenario", "Scenario"],
  ] as const) {
    const result = data[mode];
    if (!result) continue;
    rows.push([label, "All races", result.overall]);
    for (const [race, metrics] of result.perRace) rows.push([label, race, metrics]);
  }
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-medium text-text-muted hover:text-text">
        Per race and mode
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-text-muted">
            <tr>
              {["Mode", "Race", "Stops", "MAE", "Exact", "±1", "90% interval", "Baseline MAE"].map(
                (h) => (
                  <th key={h} scope="col" className="py-1.5 pr-3 font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map(([mode, race, m]) => (
              <tr key={`${mode}-${race}`} className="border-t border-border">
                <td className="py-1.5 pr-3">{mode}</td>
                <th scope="row" className="py-1.5 pr-3 font-medium">
                  {race}
                </th>
                <td className="py-1.5 pr-3">{m.n}</td>
                <td className="py-1.5 pr-3">{m.mae.toFixed(2)}</td>
                <td className="py-1.5 pr-3">{formatPercent(m.exact_rate)}</td>
                <td className="py-1.5 pr-3">{formatPercent(m.within_one_rate)}</td>
                <td className="py-1.5 pr-3">{formatPercent(m.interval_coverage)}</td>
                <td className="py-1.5">{m.baseline_mae.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function AssumptionTable({ assumptions }: { assumptions: readonly Schema<"Assumption">[] }) {
  const groups = new Map<string, Schema<"Assumption">[]>();
  for (const item of assumptions) {
    groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  }
  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([group, items]) => (
        <section key={group} aria-label={group}>
          <h3 className="mb-2 text-sm font-semibold text-accent-text">{group}</h3>
          <dl className="divide-y divide-border rounded-xl border border-border">
            {items.map((item) => (
              <div key={item.name} className="grid gap-1 p-3 sm:grid-cols-[16rem_6rem_1fr]">
                <dt className="font-mono text-xs break-all">{item.name}</dt>
                <dd className="tabular text-sm font-semibold">{item.value}</dd>
                <dd className="text-sm text-text-muted">
                  <RichText text={item.description} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/** Renders the ``literal`` spans of docstring-sourced descriptions as inline code. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("``").map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className="rounded bg-raised px-1 font-mono text-xs text-text">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}
