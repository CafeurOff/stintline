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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm text-muted">{eyebrow}</p>}
        <h1 className="text-3xl leading-tight font-bold sm:text-4xl">{title}</h1>
        {children && <div className="mt-1 text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
