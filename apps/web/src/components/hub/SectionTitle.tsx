import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

/** Section heading, and an optional "see all" link on the right. */
export function SectionTitle({
  id,
  children,
  to,
  linkLabel,
}: {
  id: string;
  children: ReactNode;
  to?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="text-xl font-bold tracking-tight">
        {children}
      </h2>
      {to && linkLabel && (
        <Link
          to={to}
          className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
        >
          {linkLabel}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </div>
  );
}
