import type { ReactNode } from "react";

import { useDocumentTitle } from "@/lib/useDocumentTitle";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}

/** Page title block: small context line, the title, a short description, actions. */
export function PageHeader({ eyebrow, title, children, actions }: PageHeaderProps) {
  useDocumentTitle(title);
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-bold tracking-widest text-mark-text uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="flex items-center gap-3 text-3xl leading-none font-black tracking-tight uppercase sm:text-5xl">
          <span aria-hidden="true" className="h-8 w-2 shrink-0 -skew-x-[16deg] bg-mark sm:h-10" />
          {title}
        </h1>
        {children && <div className="mt-3 max-w-3xl text-lg text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
