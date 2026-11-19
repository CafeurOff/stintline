import type { ReactNode } from "react";
import type { CSSProperties } from "react";

import { Trails } from "@/components/glass/Trails";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** Context colour (team, circuit) lighting the band; race red by default. */
  colour?: string;
  /** Picture or drawing on the right of the band (portrait, car, circuit). */
  aside?: ReactNode;
}

/**
 * Page title band: a frosted block lit from its corner, light trails, the context line, the
 * title in wide capitals, a short description and the page filters on the right.
 */
export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
  colour = "var(--color-mark)",
  aside,
}: PageHeaderProps) {
  useDocumentTitle(title);
  return (
    <header
      className="glass glow relative mb-5 overflow-hidden rounded-[24px]"
      style={{ "--glow": colour, "--glow-x": "100%", "--glow-y": "0%" } as CSSProperties}
    >
      <Trails colour={colour} className="opacity-60" />
      <div className="relative flex flex-wrap items-end justify-between gap-5 p-6 sm:p-8">
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="mb-2 text-sm font-semibold text-muted">{eyebrow}</p>}
          <h1 className="display text-3xl leading-[0.95] sm:text-5xl">{title}</h1>
          {children && <div className="mt-3 max-w-3xl text-muted">{children}</div>}
        </div>
        {aside}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
