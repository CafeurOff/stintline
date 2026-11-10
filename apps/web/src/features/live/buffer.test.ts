import type { Buffered, LiveSnapshot } from "./buffer";
import { BUFFER_MS, delayed, push } from "./buffer";

const item = (receivedAt: number): Buffered => ({
  receivedAt,
  snapshot: { lap: receivedAt } as unknown as LiveSnapshot,
});

describe("TV delay buffer", () => {
  it("drops snapshots older than the buffer", () => {
    const buffer = push([item(0), item(1000)], item(BUFFER_MS + 500));

    expect(buffer.map((b) => b.receivedAt)).toEqual([1000, BUFFER_MS + 500]);
  });

  it("shows the latest snapshot at least the delay old", () => {
    const buffer = [item(0), item(10_000), item(20_000), item(30_000)];

    expect(delayed(buffer, 30_000, 0)?.receivedAt).toBe(30_000);
    expect(delayed(buffer, 30_000, 15)?.receivedAt).toBe(10_000);
  });

  it("falls back to the oldest snapshot while the delay fills up", () => {
    expect(delayed([item(5000)], 6000, 60)?.receivedAt).toBe(5000);
    expect(delayed([], 0, 0)).toBeNull();
  });
});
