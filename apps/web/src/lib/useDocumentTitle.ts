import { useEffect } from "react";

export const SITE_NAME = "StintLine";

/** Sets the browser tab title to "<title> · StintLine" while the page is shown.
 * Pass nothing (or an empty value while data loads) to show the site name alone. */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}
