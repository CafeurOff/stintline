import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n/context";

export function ShowAll({
  hidden,
  open,
  onToggle,
}: {
  hidden: number;
  open: boolean;
  onToggle: () => void;
}): ReactNode {
  const { t } = useI18n();
  if (!open && hidden <= 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="self-start rounded-lg border border-line-strong px-4 py-2 font-semibold hover:border-ink"
    >
      {open ? t("common.showLess") : t("common.showAll", { n: hidden })}
    </button>
  );
}
