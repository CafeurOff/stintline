import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

/** Time for a lazy page to load and set its title before it is announced. */
const ANNOUNCE_DELAY_MS = 600;

/**
 * A new page (not a new filter) moves the focus to the content and announces the page
 * title, as a full page load would for screen readers.
 */
export function RouteAnnouncer() {
  const location = useLocation();
  const { pathname } = location;
  const state: unknown = location.state;
  const keepFocus =
    typeof state === "object" && state !== null && "keepFocus" in state && state.keepFocus === true;
  const first = useRef(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!keepFocus) document.getElementById("main")?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => {
      setMessage(document.title);
    }, ANNOUNCE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname, keepFocus]);
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}
