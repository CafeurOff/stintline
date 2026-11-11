import { describe, expect, it } from "vitest";

import { timeLeft } from "./useClock";

describe("timeLeft", () => {
  it("splits the remaining time into days, hours, minutes and seconds", () => {
    const now = Date.UTC(2026, 10, 11, 12, 0, 0);
    const target = now + ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000;

    expect(timeLeft(target, now)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it("stops at zero once the time has passed", () => {
    expect(timeLeft(0, 1000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
