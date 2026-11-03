import { compoundInfo } from "@/lib/compounds";

interface CompoundBadgeProps {
  compound: string | null | undefined;
  size?: "sm" | "md";
  showLabel?: boolean;
}

/** Tyre compound as a coloured disc with its letter, so colour is never the only signal. */
export function CompoundBadge({ compound, size = "sm", showLabel = false }: CompoundBadgeProps) {
  const info = compoundInfo(compound);
  const disc = size === "sm" ? "size-5 text-[0.65rem]" : "size-7 text-xs";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        role="img"
        aria-label={info.label}
        title={info.label}
        style={{ backgroundColor: info.fill }}
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-ink ring-1 ring-border-strong ${disc}`}
      >
        <span aria-hidden="true">{info.letter}</span>
      </span>
      {showLabel && <span className="text-sm">{info.label}</span>}
    </span>
  );
}
