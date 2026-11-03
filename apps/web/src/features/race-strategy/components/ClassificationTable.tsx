import type { Schema } from "@stintline/api-types";

import { CompoundBadge } from "@/components/racing/CompoundBadge";
import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { formatPosition } from "@/lib/format";

import { byFinish, driverName, type Entry } from "../entries";

interface ClassificationTableProps {
  entries: readonly Entry[];
  stints: readonly Schema<"EntryStints">[];
}

/** Final classification with positions gained, stops and compounds used. */
export function ClassificationTable({ entries, stints }: ClassificationTableProps) {
  const stintsByCar = new Map(stints.map((row) => [row.car_number, row]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Classification</caption>
        <thead className="text-xs text-text-muted">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">
              Pos
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Driver
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Grid
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Stops
            </th>
            <th scope="col" className="py-2 font-medium">
              Tyres
            </th>
          </tr>
        </thead>
        <tbody className="tabular">
          {[...entries].sort(byFinish).map((entry) => {
            const row = stintsByCar.get(entry.car_number);
            const gained =
              entry.grid_position && entry.finish_position
                ? entry.grid_position - entry.finish_position
                : null;
            return (
              <tr key={entry.car_number} className="border-t border-border">
                <td className="py-2 pr-3 font-semibold">
                  {entry.finish_position ?? entry.classification ?? "—"}
                </td>
                <th scope="row" className="py-2 pr-3 font-normal">
                  <span className="flex items-center gap-2.5">
                    <DriverAvatar
                      size="sm"
                      carNumber={entry.car_number}
                      name={driverName(entry)}
                      colour={entry.team_colour}
                      imageUrl={entry.media?.driver_image_url}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{driverName(entry)}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {entry.team_display_name ?? entry.team.name}
                        {entry.finish_position == null && entry.status ? ` · ${entry.status}` : ""}
                      </span>
                    </span>
                  </span>
                </th>
                <td className="py-2 pr-3">
                  {formatPosition(entry.grid_position)}
                  {gained !== null && gained !== 0 && (
                    <span className={`ml-1.5 text-xs ${gained > 0 ? "text-ok" : "text-danger"}`}>
                      {gained > 0 ? `▲${gained}` : `▼${-gained}`}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3">{row ? row.pit_stops.length : "—"}</td>
                <td className="py-2">
                  <span className="flex gap-1">
                    {row?.stints.map((stint) => (
                      <CompoundBadge key={stint.stint_number} compound={stint.compound} />
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
