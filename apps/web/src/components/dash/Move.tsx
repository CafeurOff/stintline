import { ArrowDown, ArrowUp } from "lucide-react";

import { useI18n } from "@/lib/i18n/context";

/** Places won (positive) or lost, as a green or red arrow with the count. */
export function Move({ value }: { value: number }) {
  const { t } = useI18n();
  if (value === 0) return <span className="text-muted">—</span>;
  const up = value > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={`num inline-flex items-center gap-0.5 text-xs font-semibold ${
        up ? "text-gain" : "text-loss"
      }`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {Math.abs(value)}
      <span className="sr-only">{up ? t("dash.up") : t("dash.down")}</span>
    </span>
  );
}
