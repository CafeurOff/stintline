import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  /** Keep the label for assistive tech only. */
  hideLabel?: boolean;
  children: ReactNode;
}

/** Native select drawn as a filter pill: the label, then the current value. */
export function Select({
  label,
  hideLabel = false,
  children,
  className = "",
  ...props
}: SelectProps) {
  const id = useId();
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-line bg-panel py-1 pr-1 pl-3 ${className}`}
    >
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm font-semibold"}>
        {label}
      </label>
      <select
        id={id}
        className="min-w-0 rounded-md bg-raised px-2 py-1 text-sm font-semibold text-ink"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
