interface SkeletonProps {
  className?: string;
  label?: string;
}

/** Loading placeholder. Announced once to screen readers through its label. */
export function Skeleton({ className = "h-24", label = "Loading…" }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-pulse rounded-xl bg-raised ${className}`}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}
