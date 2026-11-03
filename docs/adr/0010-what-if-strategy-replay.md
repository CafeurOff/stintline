# 0010. What-if: replay a whole race with another strategy

- Status: Accepted (Phase 8, 2026-11-03)

## Context
The main purpose of StintLine (ADR 0008) is to let fans replay a Grand Prix with a different strategy than the team's. Two approaches were possible:

1. **Full simulation**: rebuild every car's race from a pace model (car offset, tyre wear, fuel, pit loss), then change one car's plan. Clean, but the replayed race no longer matches the real one even with the real plans: noise, traffic, mistakes and safety-car timing all disappear.
2. **Delta replay**: keep the real race, and add to the chosen car's real lap times only the modelled difference between the new plan and the real one (tyre pace by compound and age, pit loss added or removed). With the real plan, the replay *is* the real race.

## Decision
Delta replay (`stintline_strategy.whatif`).
- The other cars keep their real race and official times (with penalties). They do not react, and overtaking costs nothing. Both are stated in the UI ("the other drivers keep their real race") and in `docs/model.md`.
- Tyre deltas are zero on neutralised laps; stop losses follow the lap's conditions (green, SC, VSC).
- The result is a time with an uncertainty (pit-loss spread of each changed stop, degradation slope errors correlated across laps), turned into a probability for each finishing position against the fixed rivals, and the points of that position in the real classification.
- The plan is part of the address (`?mode=strategy&plan=M-31H`), so a scenario can be shared.
- The replayed car is drawn as a ghost on the circuit next to the real one, with its margin.
- Validation: synthetic races with the same noise and only one plan changed give the exact answer; the replay must land within max(1 s, 2σ).

## Consequences
- Simple, explainable, and exact when nothing changes. It cannot show knock-on effects (a rival covering the stop, a car stuck in a DRS train). A traffic model and rival reactions are possible follow-ups.
- Wet races, retired cars and cars with gaps in their timing are refused with a clear message.
