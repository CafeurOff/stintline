import type { ReactNode } from "react";

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "accent" | "ok" | "danger";
}

const TONE: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "text-text",
  accent: "text-accent-text",
  ok: "text-ok",
  danger: "text-danger",
};

/** Key figure: small caps label, large tabular value, optional hint. */
export function Stat({ label, value, hint, tone = "default" }: StatProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-text-muted uppercase">{label}</dt>
      <dd className={`tabular text-2xl font-semibold tracking-tight ${TONE[tone]}`}>{value}</dd>
      {hint && <dd className="text-xs text-text-muted">{hint}</dd>}
    </div>
  );
}
