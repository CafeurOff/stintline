import { describe, expect, it } from "vitest";

import { advance, expected, MAX_AHEAD, type Motion, observe, wrap } from "./motion";

const RATE = 0.0125; // an 80 s lap

function run(motion: Motion, from: number, to: number, stepMs = 16): Motion {
  let current = motion;
  for (let t = from + stepMs; t <= to; t += stepMs) current = advance(current, t, stepMs / 1000);
  return current;
}

describe("wrap", () => {
  it("folds a step over the line into a small one", () => {
    expect(wrap(0.02 - 0.98)).toBeCloseTo(0.04);
    expect(wrap(0.98 - 0.02)).toBeCloseTo(-0.04);
  });
});

describe("expected", () => {
  it("moves on at the car's pace, a little past the last loop at most", () => {
    const observation = { fraction: 0.5, at: 0, rate: RATE };

    expect(expected(observation, 2000)).toBeCloseTo(0.525);
    expect(expected(observation, 60_000)).toBeCloseTo(0.5 + MAX_AHEAD);
  });
});

describe("motion", () => {
  it("never goes backwards when a loop says the car is behind the shown position", () => {
    let motion = observe(undefined, { fraction: 0.5, at: 0, rate: RATE }, 0);
    motion = run(motion, 0, 4000); // shown runs on to about 0.55
    const before = motion.shown;

    motion = observe(motion, { fraction: 0.52, at: 4000, rate: RATE }, 4000);
    const after = run(motion, 4000, 4500);

    expect(after.shown).toBeGreaterThanOrEqual(before);
  });

  it("catches up with a car shown behind, without overshooting", () => {
    let motion = observe(undefined, { fraction: 0.1, at: 0, rate: RATE }, 0);
    motion = observe(motion, { fraction: 0.15, at: 0, rate: RATE }, 0);

    const later = run(motion, 0, 3000);

    expect(later.shown).toBeGreaterThan(0.15);
    expect(later.shown).toBeLessThanOrEqual(expected(later.observation, 3000) + 1e-9);
  });

  it("jumps to a car far from where it is shown", () => {
    const motion = observe(undefined, { fraction: 0.1, at: 0, rate: RATE }, 0);

    expect(observe(motion, { fraction: 0.6, at: 0, rate: RATE }, 0).shown).toBeCloseTo(0.6);
  });

  it("crosses the line smoothly", () => {
    let motion = observe(undefined, { fraction: 0.98, at: 0, rate: RATE }, 0);
    motion = observe(motion, { fraction: 0.01, at: 1000, rate: RATE }, 1000);

    const later = run(motion, 1000, 3000);

    expect(later.shown).toBeGreaterThan(0);
    expect(later.shown).toBeLessThan(0.1); // over the line, not sent back round the lap
  });
});
