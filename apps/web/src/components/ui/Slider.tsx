import { useId, useState } from "react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Short visible value (`Lap 20`). */
  display: (value: number) => string;
  /** Spoken value for assistive tech (`Lap 20 of 70`). */
  valueText: (value: number) => string;
}

/**
 * Native range input with a label, a visible value and `aria-valuetext`.
 *
 * The thumb follows a local value so fast keyboard or pointer input is never lost while
 * the parent's value (often URL state) catches up; a new parent value resets it.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
  valueText,
}: SliderProps) {
  const id = useId();
  const [local, setLocal] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setLocal(value);
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-text-muted">
          {label}
        </label>
        <output htmlFor={id} className="tabular text-sm font-semibold">
          {display(local)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        aria-valuetext={valueText(local)}
        onChange={(event) => {
          const next = Number(event.target.value);
          setLocal(next);
          onChange(next);
        }}
        className="w-full accent-accent"
      />
    </div>
  );
}
