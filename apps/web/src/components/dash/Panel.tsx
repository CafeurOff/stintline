import { type ReactNode, useId } from "react";

/**
 * Dashboard panel: a bordered surface with a header (icon, title, optional actions on the
 * right) and free content. Labelled by its title, so it reads as a region.
 */
export function Panel({
  id,
  title,
  icon,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  id?: string;
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const generated = useId();
  const titleId = id ?? generated;
  return (
    <section
      aria-labelledby={titleId}
      className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-panel ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 id={titleId} className="flex items-center gap-2.5 text-lg font-bold">
          {icon && (
            <span aria-hidden="true" className="text-mark-text [&>svg]:size-5">
              {icon}
            </span>
          )}
          {title}
        </h2>
        {action}
      </div>
      <div className={`flex min-w-0 flex-1 flex-col ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** A key figure in a tile: label, an icon in a square, then any content (number, driver). */
export function Tile({
  label,
  icon,
  children,
  className = "",
}: {
  label: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={`relative flex min-h-32 flex-col gap-3 overflow-hidden rounded-xl border border-line bg-panel p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={id} className="text-sm font-semibold">
          {label}
        </h2>
        {icon && (
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted [&>svg]:size-4"
          >
            {icon}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Link or button at the foot of a panel ("Full standings →"). */
export function PanelFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto border-t border-line text-sm font-semibold [&>*]:flex [&>*]:items-center [&>*]:justify-center [&>*]:gap-2 [&>*]:py-3 [&>*:hover]:bg-raised">
      {children}
    </div>
  );
}
