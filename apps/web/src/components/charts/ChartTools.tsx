import { Download, Link2, Minus, Plus, RotateCcw, Sheet } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { chartPng, fileSlug, saveBlob, toCsv } from "@/lib/exportChart";
import { useI18n } from "@/lib/i18n/context";

import type { Zoom } from "./zoom";

const BUTTON =
  "grid size-8 place-items-center rounded-lg border border-line text-muted transition hover:border-line-strong hover:text-ink disabled:opacity-40";

/** How long "Link copied" stays, in milliseconds. */
const NOTICE_MS = 2500;

export type CsvRows = readonly (readonly (string | number | null | undefined)[])[];

/**
 * The hint and the buttons above a chart: zoom (keyboard users zoom with + and −), copy the
 * link of the view (filters and drivers live in the address), save the chart as a picture
 * and, when the chart gives its rows, its data as CSV.
 */
export function ChartTools({
  zoom,
  children,
  csv,
}: {
  zoom: Zoom;
  children?: ReactNode;
  /** The data drawn, header first; the CSV button shows only with it. */
  csv?: (() => CsvRows) | undefined;
}) {
  const { t } = useI18n();
  const bar = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");

  const say = (message: string) => {
    setNotice(message);
    window.setTimeout(() => {
      setNotice("");
    }, NOTICE_MS);
  };
  const chart = () => bar.current?.parentElement?.querySelector<SVGSVGElement>("svg[role='img']");
  const title = () => chart()?.querySelector("title")?.textContent.trim() ?? document.title;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      say(t("chart.linkCopied"));
    } catch {
      say(t("chart.linkFailed"));
    }
  };
  const savePng = async () => {
    const svg = chart();
    if (!svg) return;
    try {
      const blob = await chartPng(svg, title(), t("chart.credit", { host: window.location.host }));
      saveBlob(blob, `${fileSlug(title())}.png`);
    } catch {
      say(t("chart.saveFailed"));
    }
  };
  const saveCsv = () => {
    if (!csv) return;
    saveBlob(
      new Blob([toCsv(csv())], { type: "text/csv;charset=utf-8" }),
      `${fileSlug(title())}.csv`,
    );
  };

  return (
    <div ref={bar} className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted">{zoom.zoomed ? t("chart.zoomed") : t("chart.hint")}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span role="status" className="text-xs font-semibold text-gain">
          {notice}
        </span>
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
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />
        <button
          type="button"
          className={BUTTON}
          aria-label={t("chart.copyLink")}
          title={t("chart.copyLink")}
          onClick={() => void copyLink()}
        >
          <Link2 aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={BUTTON}
          aria-label={t("chart.savePng")}
          title={t("chart.savePng")}
          onClick={() => void savePng()}
        >
          <Download aria-hidden="true" className="size-4" />
        </button>
        {csv && (
          <button
            type="button"
            className={BUTTON}
            aria-label={t("chart.saveCsv")}
            title={t("chart.saveCsv")}
            onClick={saveCsv}
          >
            <Sheet aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
