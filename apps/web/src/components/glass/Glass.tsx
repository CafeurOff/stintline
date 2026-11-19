import type { CSSProperties, ReactNode } from "react";
import { useId } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

/**
 * Glass skin blocks (pilot on the home page): a frosted card with an optional coloured glow,
 * pill buttons and the white-on-black segmented control.
 */

export function GlassCard({
  id,
  title,
  eyebrow,
  action,
  glow,
  children,
  className = "",
  bodyClassName = "",
}: {
  id?: string;
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  /** Colour of the glow from the top of the card; none when absent. */
  glow?: string | null;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const generated = useId();
  const titleId = id ?? generated;
  const style = glow
    ? ({ "--glow": glow, "--glow-x": "100%", "--glow-y": "0%" } as CSSProperties)
    : undefined;
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={`glass reveal relative flex min-w-0 flex-col overflow-hidden rounded-[20px] ${
        glow ? "glow" : ""
      } ${className}`}
      style={style}
    >
      {title && (
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 pt-6 pb-2">
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-semibold text-muted">{eyebrow}</p>}
            <h2 id={titleId} className="display text-lg">
              {title}
            </h2>
          </div>
          {action}
        </div>
      )}
      <div className={`relative flex min-w-0 flex-1 flex-col ${bodyClassName}`}>{children}</div>
    </section>
  );
}

const PILL = "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition";

/** White pill on dark (black on light): the one main action of a block. */
export const pillPrimary = `${PILL} bg-ink text-bg hover:opacity-90`;
/** Frosted pill for secondary actions. */
export const pillGlass = `${PILL} glass hover:border-line-strong`;

/** "See all" link in a card header: label and chevron. */
export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
    >
      {children}
      <ChevronRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

/** Two or more choices in a dark capsule, the chosen one in a white pill. */
export function PillSwitch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex w-fit gap-1 rounded-xl border border-line bg-bg/60 p-1"
    >
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => {
            onChange(key);
          }}
          className="rounded-lg px-4 py-1.5 text-xs font-bold text-muted transition hover:text-ink aria-pressed:bg-ink aria-pressed:text-bg"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Round frosted icon holder for widget tiles. */
export function IconBubble({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-ink/5 [&>svg]:size-4"
    >
      {children}
    </span>
  );
}
