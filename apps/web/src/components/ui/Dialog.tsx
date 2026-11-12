import { type ReactNode, useEffect, useId, useRef } from "react";

import { useI18n } from "@/lib/i18n/context";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Modal built on the native `<dialog>`: focus is trapped and restored by the browser,
 * Escape closes it, the page behind is inert. Full screen on phones.
 */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-panel p-0 text-ink backdrop:bg-black/70 sm:m-auto sm:h-auto sm:max-h-[85vh] sm:max-w-3xl sm:rounded-xl sm:border sm:border-line"
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="grid size-9 place-items-center rounded-full text-2xl leading-none text-muted hover:bg-raised hover:text-ink"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
