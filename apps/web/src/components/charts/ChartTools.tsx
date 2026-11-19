import { Minus, Plus, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n/context";

import type { Zoom } from "./zoom";

const BUTTON =
  "grid size-8 place-items-center rounded-lg border border-line text-muted transition hover:border-line-strong hover:text-ink disabled:opacity-40";

/** The hint and the zoom buttons above a chart (keyboard users zoom with + and −). */
export function ChartTools({ zoom, children }: { zoom: Zoom; children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted">{zoom.zoomed ? t("chart.zoomed") : t("chart.hint")}</p>
      <div className="flex items-center gap-1.5">
        {children}
        <button
          type="button"
          className={BUTTON}
          aria-label={t("chart.zoomIn")}
          onClick={zoom.zoomIn}
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={BUTTON}
          aria-label={t("chart.zoomOut")}
          onClick={zoom.zoomOut}
          disabled={!zoom.zoomed}
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={BUTTON}
          aria-label={t("chart.reset")}
          onClick={zoom.reset}
          disabled={!zoom.zoomed}
        >
          <RotateCcw aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
