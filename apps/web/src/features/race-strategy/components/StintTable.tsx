import type { Schema } from "@stintline/api-types";

import { CompoundBadge } from "@/components/racing/CompoundBadge";

import { byFinish, driverName, type Entry } from "../entries";

interface StintTableProps {
  rows: readonly Schema<"EntryStints">[];
  entries: Map<number, Entry>;
}

/** Table alternative to the stint timeline. */
export function StintTable({ rows, entries }: StintTableProps) {
  return (
    <div className="mt-2 max-h-96 overflow-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Stints by driver</caption>
        <thead className="sticky top-0 bg-surface text-xs text-text-muted">
          <tr>
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Driver
            </th>
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Stint
            </th>
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Compound
            </th>
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Laps
            </th>
            <th scope="col" className="py-1.5 font-medium">
              Tyre age at start
            </th>
          </tr>
        </thead>
        <tbody className="tabular">
          {[...rows].sort(byFinish).flatMap((row) => {
            const entry = entries.get(row.car_number);
            const name = entry ? driverName(entry) : `Car ${row.car_number}`;
            return row.stints.map((stint) => (
              <tr
                key={`${row.car_number}-${stint.stint_number}`}
                className="border-t border-border"
              >
                <th scope="row" className="py-1.5 pr-3 font-medium">
                  {name}
                </th>
                <td className="py-1.5 pr-3">{stint.stint_number}</td>
                <td className="py-1.5 pr-3">
                  <CompoundBadge compound={stint.compound} showLabel />
                </td>
                <td className="py-1.5 pr-3">
                  {stint.lap_start ?? "?"}–{stint.lap_end ?? "?"}
                </td>
                <td className="py-1.5">{stint.tyre_age_at_start ?? "—"}</td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}
