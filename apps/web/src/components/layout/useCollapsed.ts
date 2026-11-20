import { useState } from "react";

/** Shows the first `initial` items of a long list, with a button to show them all. */
export function useCollapsed<T>(items: readonly T[], initial: number) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, initial);
  return { shown, hidden: items.length - shown.length, open, setOpen };
}
