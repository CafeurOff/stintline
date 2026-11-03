import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  children: ReactNode;
}

/** Native select with a visible label: keyboard and screen-reader support for free. */
export function Select({ label, children, className = "", ...props }: SelectProps) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-text-muted">
        {label}
      </label>
      <select
        id={id}
        className="rounded-lg border border-border-strong bg-raised px-2.5 py-1.5 text-sm text-text"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
