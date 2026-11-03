import type { Schema } from "@stintline/api-types";

import { CompoundBadge } from "@/components/racing/CompoundBadge";
import { compoundInfo, RACE_COMPOUNDS } from "@/lib/compounds";
import { formatLapTime } from "@/lib/format";

type CompoundDegradation = Schema<"CompoundDegradation">;

function order(compound: string): number {
  const index = (RACE_COMPOUNDS as readonly string[]).indexOf(compound);
  return index === -1 ? RACE_COMPOUNDS.length : index;
}

/** Field-wide degradation per compound, softest first. */
export function CompoundSummary({ compounds }: { compounds: readonly CompoundDegradation[] }) {
  const sorted = [...compounds].sort((a, b) => order(a.compound) - order(b.compound));
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((item) => {
        const [low, high] = item.slope_ci;
        return (
          <li
            key={item.compound}
            className="rounded-2xl border border-border bg-surface p-4 shadow-soft"
          >
            <div className="flex items-center justify-between gap-2">
              <CompoundBadge compound={item.compound} size="md" showLabel />
              {item.low_confidence && (
                <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-medium text-warn">
                  Low confidence
                </span>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-text-muted">Degradation</dt>
                <dd className="tabular text-xl font-semibold">
                  {(item.slope_s_per_lap * 1000).toFixed(0)} ms/lap
                </dd>
                {low !== undefined && high !== undefined && (
                  <dd className="tabular text-xs text-text-muted">
                    95% CI {(low * 1000).toFixed(0)}–{(high * 1000).toFixed(0)}
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-xs text-text-muted">New-tyre pace</dt>
                <dd className="tabular text-xl font-semibold">
                  {formatLapTime(item.new_tyre_pace_s)}
                </dd>
                <dd className="tabular text-xs text-text-muted">
                  {item.n_stints} stints · {item.n_laps} laps
                </dd>
              </div>
            </dl>
            <p className="sr-only">{compoundInfo(item.compound).label} compound summary</p>
          </li>
        );
      })}
    </ul>
  );
}
