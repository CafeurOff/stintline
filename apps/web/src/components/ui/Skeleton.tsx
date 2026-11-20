import { useI18n } from "@/lib/i18n/context";

/** Loading placeholder, announced once to screen readers. */
export function Skeleton({ className = "h-24", label }: { className?: string; label?: string }) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-pulse rounded-[20px] bg-raised ${className}`}
    >
      <span className="sr-only">{label ?? t("common.loading")}</span>
    </div>
  );
}

/**
 * Placeholder for a row of tiles that fills in after its own query: it holds the space the
 * tiles will take, so the blocks below do not jump when they arrive (layout shift).
 */
export function SkeletonTiles({
  className,
  tile,
  count = 4,
}: {
  /** The grid classes of the real row. */
  className: string;
  /** The height of one tile. */
  tile: string;
  count?: number;
}) {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={`animate-pulse rounded-[20px] bg-raised ${tile}`} />
      ))}
    </div>
  );
}
