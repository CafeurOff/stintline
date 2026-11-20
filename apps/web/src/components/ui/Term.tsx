import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useI18n } from "@/lib/i18n/context";
import { glossaryEntry, type TermId } from "@/lib/i18n/glossary";

/** Room kept between the definition and the edge of the screen, in pixels. */
const EDGE = 12;
/** Widest definition, in pixels (20rem). */
const TIP_WIDTH = 320;

interface Place {
  top: number;
  left: number;
  width: number;
}

/** Below the word, centred on it, kept inside the screen. */
function placeUnder(anchor: DOMRect): Place {
  const width = Math.min(TIP_WIDTH, window.innerWidth - 2 * EDGE);
  const centre = anchor.left + anchor.width / 2;
  const left = Math.min(Math.max(centre - width / 2, EDGE), window.innerWidth - EDGE - width);
  return { top: anchor.bottom + 8, left, width };
}

/**
 * A racing or statistics term with its definition from the glossary, shown on mouse hover,
 * on keyboard focus and on tap, closed with Escape, a tap elsewhere or a scroll. The word
 * is a button, so it is reachable and announced; the definition is tied to it with
 * `aria-describedby` while it shows. It floats above the page (a portal), so cards that
 * clip their content do not cut it.
 */
export function Term({ id, children }: { id: TermId; children?: ReactNode }) {
  const { locale } = useI18n();
  const entry = glossaryEntry(id, locale);
  const [place, setPlace] = useState<Place | null>(null);
  const tipId = useId();
  const button = useRef<HTMLButtonElement>(null);

  const show = () => {
    if (button.current) setPlace(placeUnder(button.current.getBoundingClientRect()));
  };
  const hide = () => {
    setPlace(null);
  };

  useEffect(() => {
    if (!place) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && button.current?.contains(event.target)) return;
      hide();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
    };
  }, [place]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-describedby={place ? tipId : undefined}
        aria-expanded={place !== null}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") show();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") hide();
        }}
        onClick={() => {
          if (place) hide();
          else show();
        }}
        onFocus={show}
        onBlur={hide}
        className="cursor-help text-left underline decoration-current/50 decoration-dotted underline-offset-[3px] hover:decoration-current"
      >
        {children ?? entry.term}
      </button>
      {place &&
        createPortal(
          <span
            id={tipId}
            role="tooltip"
            className="pointer-events-none fixed z-50 block rounded-xl border border-line-strong bg-panel px-3 py-2 text-left text-xs leading-relaxed font-normal text-ink normal-case shadow-xl"
            style={{ top: place.top, left: place.left, maxWidth: place.width }}
          >
            <span className="mb-0.5 block font-bold">{entry.term}</span>
            {entry.definition}
          </span>,
          document.body,
        )}
    </>
  );
}

/** "Words on this page": the terms of a page as a row of help buttons. */
export function TermList({ ids }: { ids: readonly TermId[] }) {
  const { t } = useI18n();
  if (ids.length === 0) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
      <span className="font-semibold">{t("glossary.onThisPage")}</span>
      {ids.map((id) => (
        <Term key={id} id={id} />
      ))}
    </p>
  );
}
