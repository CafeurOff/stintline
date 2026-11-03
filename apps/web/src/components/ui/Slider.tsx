import { useId, useState } from "react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Spoken value for assistive tech (`Lap 20 of 70`). */
  valueText: (value: number) => string;
  hideLabel?: boolean;
}

/**
 * Native range input. The thumb follows a local value so fast keyboard or pointer input
 * is never lost while the parent's value catches up; a new parent value resets it.
 */
export function Slider({
  label,
  value,
  min,
  max,
  onChange,
  valueText,
  hideLabel = false,
}: SliderProps) {
  const id = useId();
  const [local, setLocal] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setLocal(value);
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm text-muted"}>
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={local}
        aria-valuetext={valueText(local)}
        onChange={(event) => {
          const next = Number(event.target.value);
          setLocal(next);
          onChange(next);
        }}
        className="w-full accent-mark"
      />
    </div>
  );
}
