import type { ReactNode } from "react";
import { Link } from "react-router";

/** Section heading with the race-red slash, and an optional "see all" link. */
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
    <div className="flex items-end justify-between gap-3 border-b border-line pb-2">
      <h2 id={id} className="flex items-center gap-2.5 text-xl font-bold tracking-tight uppercase">
        <span aria-hidden="true" className="h-5 w-1.5 -skew-x-[16deg] bg-mark" />
        {children}
      </h2>
      {to && linkLabel && (
        <Link to={to} className="text-sm font-semibold text-mark-text hover:underline">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
