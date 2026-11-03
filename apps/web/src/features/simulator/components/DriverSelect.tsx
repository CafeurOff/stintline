import { Select } from "@/components/ui/Select";
import { driverName, type Entry } from "@/features/race-strategy/entries";

interface DriverSelectProps {
  label: string;
  entries: readonly Entry[];
  value: number;
  onChange: (car: number) => void;
}

export function DriverSelect({ label, entries, value, onChange }: DriverSelectProps) {
  return (
    <Select
      label={label}
      value={value}
      onChange={(event) => {
        onChange(Number(event.target.value));
      }}
    >
      {entries.map((entry) => (
        <option key={entry.car_number} value={entry.car_number}>
          {entry.finish_position ? `P${entry.finish_position} ` : ""}
          {driverName(entry)} (#{entry.car_number})
        </option>
      ))}
    </Select>
  );
}
