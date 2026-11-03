import { useId, type ReactNode } from "react";

interface CardProps {
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Elevated surface with an optional heading. The heading labels the region. */
export function Card({ title, eyebrow, actions, children, className = "" }: CardProps) {
  const id = useId();
  const headingId = title ? id : undefined;
  return (
    <section
      aria-labelledby={headingId}
      className={`min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5 ${className}`}
    >
      {(title ?? actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {eyebrow && (
              <p className="text-xs font-semibold tracking-wider text-accent-text uppercase">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 id={headingId} className="text-lg font-semibold tracking-tight">
                {title}
              </h2>
            )}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
