import { useEffect, useState } from "react";

import { type Buffered, type LiveSnapshot, push } from "./buffer";

/** Back-off between reconnections, in ms; the last one repeats. */
const RETRY_MS = [1000, 2000, 5000, 10_000] as const;

function socketUrl(): string {
  const { protocol, host } = globalThis.location;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}/ws/live`;
}

/**
 * Snapshots pushed by the local live process over `/ws/live`, buffered for the TV delay.
 * Reconnects on its own; `connected` says whether the socket is open right now.
 */
export function useLiveSocket(enabled: boolean) {
  const [buffer, setBuffer] = useState<Buffered[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let socket: WebSocket | null = null;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const open = () => {
      socket = new WebSocket(socketUrl());
      socket.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        const snapshot = JSON.parse(event.data) as LiveSnapshot;
        setBuffer((previous) => push(previous, { receivedAt: Date.now(), snapshot }));
      };
      socket.onclose = () => {
        setConnected(false);
        if (stopped) return;
        const wait = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)];
        attempt += 1;
        timer = setTimeout(open, wait);
      };
    };
    open();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [enabled]);

  return { buffer, connected };
}
