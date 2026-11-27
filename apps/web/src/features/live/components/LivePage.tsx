import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useI18n } from "@/lib/i18n/context";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

import { useLiveStatus } from "../api";
import { delayed, TV_DELAYS, type TvDelay } from "../buffer";
import { useLiveSocket } from "../useLiveSocket";
import { Live } from "./LiveSession";
import { Offline } from "./Offline";

const DELAY_KEY = "stintline-tv-delay";

/** How often the page looks for the snapshot due under a TV delay. Without a delay, the
 * page follows the socket and never ticks (cars move on their own, see `LiveTrack`). */
const DELAY_TICK_MS = 500;

function storedDelay(): TvDelay {
  try {
    const value = Number(localStorage.getItem(DELAY_KEY));
    return TV_DELAYS.find((d) => d === value) ?? 0;
  } catch {
    return 0;
  }
}

function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, DELAY_TICK_MS);
    return () => {
      clearInterval(id);
    };
  }, [active]);
  return now;
}

/** Live session from the live process, with a TV delay; offline otherwise. */
export function LivePage() {
  const { t } = useI18n();
  const status = useLiveStatus();
  useDocumentTitle(t("nav.live"));
  const online = status.data !== undefined && status.data.state !== "offline";
  const { buffer, connected } = useLiveSocket(online);
  const [delay, setDelay] = useState<TvDelay>(storedDelay);
  const now = useTicker(online && delay > 0);
  const shown = delay > 0 ? delayed(buffer, now, delay) : (buffer.at(-1) ?? null);
  const snapshot = shown?.snapshot ?? status.data?.snapshot ?? null;

  if (status.isError) {
    return <ErrorState error={status.error} onRetry={() => void status.refetch()} />;
  }
  if (!status.data) return <Skeleton className="h-[60vh]" />;
  if (!online || !snapshot) return <Offline next={status.data.next_session} />;

  return (
    <Live
      snapshot={snapshot}
      receivedAt={shown?.receivedAt ?? now}
      finished={status.data.state === "finished"}
      connected={connected}
      delay={delay}
      onDelay={(value) => {
        setDelay(value);
        try {
          localStorage.setItem(DELAY_KEY, String(value));
        } catch {
          // Private mode: the choice simply is not remembered.
        }
      }}
    />
  );
}
