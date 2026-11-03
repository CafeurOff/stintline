import { useId } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Radio group styled as a segmented control. Arrow keys move between options. */
export function SegmentedControl<T extends string>({
  legend,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs font-medium text-text-muted">{legend}</legend>
      <div className="inline-flex flex-wrap rounded-lg border border-border-strong bg-raised p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className="cursor-pointer rounded-md px-2.5 py-1 text-sm text-text-muted has-checked:bg-surface has-checked:font-semibold has-checked:text-text has-checked:shadow-soft has-focus-visible:outline-2 has-focus-visible:outline-accent"
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
