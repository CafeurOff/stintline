import { useState } from "react";

/** The time the component first rendered (stable across re-renders, pure render). */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}
