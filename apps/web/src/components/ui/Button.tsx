import type { ButtonHTMLAttributes } from "react";

type Variant = "action" | "quiet";

const VARIANT_CLASS: Record<Variant, string> = {
  action: "bg-action px-4 py-3 font-bold text-white hover:brightness-110",
  quiet: "px-0 py-0 text-muted underline underline-offset-4 hover:text-ink",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "action", className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    />
  );
}
