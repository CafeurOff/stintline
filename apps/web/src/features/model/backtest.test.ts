import { model } from "@/test/fixtures/model";

import { readBacktest } from "./backtest";

describe("readBacktest", () => {
  it("reads overall and per-race metrics of both modes", () => {
    const result = readBacktest(model.backtest, "held-out");

    expect(result?.blind?.overall.n).toBe(155);
    expect(result?.scenario).not.toBeNull();
    expect(result?.blind?.perRace.map(([race]) => race)).toContain("Japanese Grand Prix");
  });

  it("returns null for a missing or malformed set", () => {
    expect(readBacktest({}, "held-out")).toBeNull();
    expect(readBacktest({ x: { blind: { overall: { n: "many" } } } }, "x")).toBeNull();
  });
});
