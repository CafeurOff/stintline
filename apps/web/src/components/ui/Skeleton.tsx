import { useI18n } from "@/lib/i18n/context";

/** Loading placeholder, announced once to screen readers. */
export function Skeleton({ className = "h-24", label }: { className?: string; label?: string }) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-pulse rounded-xl bg-raised ${className}`}
    >
      <span className="sr-only">{label ?? t("common.loading")}</span>
    </div>
  );
}
