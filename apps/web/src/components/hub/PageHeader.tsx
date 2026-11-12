import type { ReactNode } from "react";

import { useDocumentTitle } from "@/lib/useDocumentTitle";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}

/**
 * Page title block, dashboard style: context line, the title, a short description, and the
 * page filters (season, Grand Prix, drivers) as pills on the right.
 */
export function PageHeader({ eyebrow, title, children, actions }: PageHeaderProps) {
  useDocumentTitle(title);
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-sm font-semibold text-mark-text">{eyebrow}</p>}
        <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{title}</h1>
        {children && <div className="mt-1.5 max-w-3xl text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
