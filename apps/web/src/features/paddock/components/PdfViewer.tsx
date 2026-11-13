import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n/context";
import { useElementWidth } from "@/lib/useElementWidth";

import { retryDelayMs } from "../penalties";

/** Attempts while the relay asks to wait for the fia.com slot (429). */
const MAX_ATTEMPTS = 4;
const ZOOMS = [1, 1.25, 1.5, 2] as const;

type Outcome = { key: string; kind: "error" } | { key: string; kind: "ready"; pages: number };

async function fetchPdf(
  url: string,
  signal: AbortSignal,
  onWait: () => void,
): Promise<ArrayBuffer> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, { signal });
    if (response.ok) return response.arrayBuffer();
    if (response.status !== 429 || attempt >= MAX_ATTEMPTS)
      throw new Error(String(response.status));
    onWait();
    await new Promise((resolve) =>
      setTimeout(resolve, retryDelayMs(response.headers.get("Retry-After"))),
    );
  }
}

/**
 * The document drawn page by page with pdf.js (loaded on first use, ADR 0018). The PDF comes
 * from our relay; the extracted text stays available as the text alternative.
 */
export function PdfViewer({ url, title }: { url: string; title: string }) {
  const { t } = useI18n();
  const [box, width] = useElementWidth<HTMLDivElement>(640);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0);
  const key = `${url}|${String(width)}|${String(zoom)}`;
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const state =
    outcome?.key === key ? outcome : { kind: "loading" as const, waiting: waitingFor === key };

  useEffect(() => {
    const controller = new AbortController();
    const stopped = () => controller.signal.aborted;
    (async () => {
      const [pdfjs, worker] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const data = await fetchPdf(url, controller.signal, () => {
        setWaitingFor(key);
      });
      const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
      const host = pagesRef.current;
      if (stopped() || !host) return;
      host.replaceChildren();
      const scaleFor = (pageWidth: number) => ((width - 2) / pageWidth) * (ZOOMS[zoom] ?? 1);
      for (let n = 1; n <= pdf.numPages; n += 1) {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: scaleFor(base.width) });
        const ratio = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${String(Math.floor(viewport.width))}px`;
        canvas.className = "mx-auto mb-3 block rounded-md bg-white shadow-sm";
        canvas.setAttribute("aria-label", t("docs.page", { n, total: pdf.numPages }));
        canvas.setAttribute("role", "img");
        host.append(canvas);
        const context = canvas.getContext("2d");
        if (!context) continue;
        await page.render({
          canvasContext: context,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        }).promise;
        if (stopped()) return;
      }
      setOutcome({ key, kind: "ready", pages: pdf.numPages });
    })().catch(() => {
      if (!stopped()) setOutcome({ key, kind: "error" });
    });
    return () => {
      controller.abort();
    };
  }, [key, url, width, zoom, t]);

  return (
    <div ref={box} className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          {state.kind === "ready" ? t("docs.pages", { n: state.pages }) : title}
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            className="grid size-8 place-items-center rounded-md border border-line hover:bg-raised disabled:opacity-40"
            onClick={() => {
              setZoom((z) => Math.max(0, z - 1));
            }}
            disabled={zoom === 0}
            aria-label={t("docs.zoomOut")}
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-md border border-line hover:bg-raised disabled:opacity-40"
            onClick={() => {
              setZoom((z) => Math.min(ZOOMS.length - 1, z + 1));
            }}
            disabled={zoom === ZOOMS.length - 1}
            aria-label={t("docs.zoomIn")}
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </span>
      </div>
      {state.kind === "loading" && (
        <div className="flex flex-col gap-2">
          {state.waiting && <p className="text-sm text-muted">{t("docs.waiting")}</p>}
          <Skeleton className="aspect-[1/1.41] w-full" />
        </div>
      )}
      {state.kind === "error" && <p className="text-sm text-loss">{t("docs.pdfError")}</p>}
      <div ref={pagesRef} className="max-h-[80vh] overflow-auto rounded-lg bg-raised p-2" />
    </div>
  );
}
