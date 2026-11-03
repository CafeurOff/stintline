import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  /** Keep the label for assistive tech only. */
  hideLabel?: boolean;
  children: ReactNode;
}

export function Select({
  label,
  hideLabel = false,
  children,
  className = "",
  ...props
}: SelectProps) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm text-muted"}>
        {label}
      </label>
      <select
        id={id}
        className="rounded-lg border border-line bg-panel px-2.5 py-1.5 font-semibold text-ink"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
