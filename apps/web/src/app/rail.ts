import { useCallback, useSyncExternalStore } from "react";

/** Desktop sidebar: full (icons and names) or a rail of icons. Phones keep their menu. */
export type RailState = "full" | "collapsed";

export const RAIL_STORAGE_KEY = "stintline-rail";
const listeners = new Set<() => void>();

/** Stored choice, else full. Storage can throw in private modes. */
export function readStoredRail(): RailState {
  try {
    return localStorage.getItem(RAIL_STORAGE_KEY) === "collapsed" ? "collapsed" : "full";
  } catch {
    return "full";
  }
}

/** `<html data-rail>` drives the layout in CSS, so the first paint is already right (the
 * inline script in index.html applies the stored choice). */
export function applyRail(state: RailState) {
  if (state === "collapsed") document.documentElement.dataset.rail = "collapsed";
  else delete document.documentElement.dataset.rail;
}

function currentRail(): RailState {
  return document.documentElement.dataset.rail === "collapsed" ? "collapsed" : "full";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current sidebar state and a toggle that persists the choice. */
export function useRail() {
  const rail = useSyncExternalStore(subscribe, currentRail, (): RailState => "full");
  const toggle = useCallback(() => {
    const next: RailState = currentRail() === "collapsed" ? "full" : "collapsed";
    applyRail(next);
    try {
      localStorage.setItem(RAIL_STORAGE_KEY, next);
    } catch {
      // The choice still applies for this page view.
    }
    listeners.forEach((listener) => {
      listener();
    });
  }, []);
  return { rail, toggle };
}

/** `[` toggles the sidebar, except while typing. */
export function isRailShortcut(event: KeyboardEvent): boolean {
  if (event.key !== "[" || event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return true;
  return !(
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
