import type { Schema } from "@stintline/api-types";

import { CompoundBadge } from "@/components/racing/CompoundBadge";

interface StintFitTableProps {
  stints: readonly Schema<"StintFit">[];
  labelFor: (carNumber: number) => string;
}

/** Table alternative to the degradation chart. */
export function StintFitTable({ stints, labelFor }: StintFitTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Degradation fit per stint</caption>
        <thead className="text-xs text-text-muted">
          <tr>
            {["Driver", "Stint", "Compound", "Degradation", "Model", "R²", "Laps"].map((h) => (
              <th key={h} scope="col" className="py-1.5 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {stints.map((stint) => (
            <tr key={`${stint.car_number}-${stint.stint}`} className="border-t border-border">
              <th scope="row" className="py-1.5 pr-3 font-medium">
                {labelFor(stint.car_number)}
              </th>
              <td className="py-1.5 pr-3">{stint.stint}</td>
              <td className="py-1.5 pr-3">
                <CompoundBadge compound={stint.compound} showLabel />
              </td>
              <td className="py-1.5 pr-3">{(stint.slope_s_per_lap * 1000).toFixed(0)} ms/lap</td>
              <td className="py-1.5 pr-3">{stint.model}</td>
              <td className="py-1.5 pr-3">{stint.r_squared.toFixed(2)}</td>
              <td className="py-1.5">{stint.n_laps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
