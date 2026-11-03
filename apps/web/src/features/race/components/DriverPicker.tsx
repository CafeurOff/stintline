import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { useI18n } from "@/lib/i18n/context";

import { driverCode, driverName, type Entry, entryPhoto } from "../entries";

interface DriverPickerProps {
  /** Cars in running order at the replay instant. */
  order: readonly number[];
  byCar: ReadonlyMap<number, Entry>;
  selected: number;
  onSelect: (car: number) => void;
}

/** The field as photos in running order: one click picks the driver to simulate. */
export function DriverPicker({ order, byCar, selected, onSelect }: DriverPickerProps) {
  const { t, f } = useI18n();
  return (
    <fieldset>
      <legend className="sr-only">{t("panel.driver")}</legend>
      <ul className="grid grid-cols-5 gap-x-1 gap-y-2">
        {order.map((car, index) => {
          const entry = byCar.get(car);
          if (!entry) return null;
          const isSelected = car === selected;
          return (
            <li key={car}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={t("panel.pick", {
                  position: f.ordinal(index + 1),
                  name: driverName(entry),
                })}
                onClick={() => {
                  onSelect(car);
                }}
                className={`flex w-full flex-col items-center gap-0.5 rounded-lg py-1 transition ${
                  isSelected ? "bg-raised" : "opacity-80 hover:bg-raised hover:opacity-100"
                }`}
              >
                <span className="relative">
                  <DriverAvatar
                    label={entry.car_number}
                    name={driverName(entry)}
                    colour={entry.team_colour}
                    imageUrl={entryPhoto(entry)}
                    size="sm"
                    decorative
                  />
                  <span
                    aria-hidden="true"
                    className={`absolute -top-1 -left-1 grid size-4 place-items-center rounded-full text-[0.6rem] font-bold tabular-nums ${
                      isSelected ? "bg-mark text-white" : "bg-bg text-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`text-xs ${isSelected ? "font-bold text-ink" : "text-muted"}`}
                >
                  {driverCode(entry)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
