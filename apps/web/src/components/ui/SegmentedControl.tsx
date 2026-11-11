import { useId } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  hideLegend?: boolean;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Radio group drawn as a segmented control. Arrow keys move between options. */
export function SegmentedControl<T extends string>({
  legend,
  hideLegend = false,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className={hideLegend ? "sr-only" : "mb-1 text-sm text-muted"}>{legend}</legend>
      <div className="relative flex overflow-x-auto rounded-lg bg-raised p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex-1 shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-center whitespace-nowrap text-muted transition has-checked:bg-panel has-checked:font-bold has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-mark"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                onChange(option.value);
              }}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
