import { useCallback } from "react";
import { useSearchParams } from "react-router";

/**
 * Shareable view state in the URL. Updates replace the history entry so dragging a slider
 * does not flood the back button.
 */
export function useSearchParamsState() {
  const [params, setParams] = useSearchParams();

  const update = useCallback(
    (changes: Record<string, string | number | null>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === "") next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [params, update] as const;
}

/** Positive integer from a search param, or `null` when absent or invalid. */
export function intParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/** Comma-separated positive integers (`4,81`), invalid items dropped. */
export function intListParam(params: URLSearchParams, key: string): number[] {
  const raw = params.get(key);
  if (!raw) return [];
  return raw
    .split(",")
    .filter((part) => /^\d+$/.test(part))
    .map(Number);
}
