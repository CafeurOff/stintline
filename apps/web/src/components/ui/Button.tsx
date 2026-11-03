import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-accent-strong text-white hover:brightness-110",
  secondary: "border border-border-strong bg-raised text-text hover:bg-hover",
  ghost: "text-text-muted hover:bg-hover hover:text-text",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    />
  );
}
