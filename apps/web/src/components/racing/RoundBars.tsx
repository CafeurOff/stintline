/** One bar per round: filled, outlined (sprint), retirement (red stub) or nothing (muted). */
export type BarKind = "hit" | "sprint" | "miss" | "dnf";

export interface RoundBar {
  key: string;
  kind: BarKind;
  /** Height from 0 to 1; hits default to full height. */
  value?: number;
  label: string;
}

/**
 * Season at a glance under a key figure: a small bar per race. Decorative next to the
 * number it explains; the per-race labels are kept as titles for pointer users.
 */
export function RoundBars({ bars, colour }: { bars: readonly RoundBar[]; colour: string }) {
  return (
    <div aria-hidden="true" className="mt-auto flex h-9 items-end gap-[3px]">
      {bars.map((bar) => {
        const height =
          bar.kind === "miss" ? 0.12 : bar.kind === "dnf" ? 0.2 : Math.max(0.15, bar.value ?? 1);
        return (
          <span
            key={bar.key}
            title={bar.label}
            className="min-w-[3px] flex-1 rounded-[2px]"
            style={{
              height: `${String(height * 100)}%`,
              backgroundColor:
                bar.kind === "hit"
                  ? colour
                  : bar.kind === "dnf"
                    ? "var(--color-loss)"
                    : bar.kind === "miss"
                      ? "var(--color-raised)"
                      : "transparent",
              border: bar.kind === "sprint" ? `1.5px solid ${colour}` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
