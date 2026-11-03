import { addStop, decodePlan, encodePlan, planProblem, planStints, realPlan } from "./strategy";

const car = {
  car_number: 4,
  line_times_s: [],
  compounds: ["MEDIUM", "MEDIUM", "MEDIUM", "HARD", "HARD"],
  tyre_ages: [],
  pit_in_laps: [3],
};

describe("strategy plans", () => {
  it("reads the real strategy from the replay data", () => {
    expect(realPlan(car)).toEqual({ start: "MEDIUM", stops: [{ lap: 3, compound: "HARD" }] });
    expect(realPlan({ ...car, compounds: [null] })).toBeNull();
  });

  it("round-trips through the address", () => {
    const plan = { start: "MEDIUM" as const, stops: [{ lap: 31, compound: "HARD" as const }] };

    expect(encodePlan(plan)).toBe("M-31H");
    expect(decodePlan("M-31H")).toEqual(plan);
    expect(decodePlan("M-31X")).toBeNull();
    expect(decodePlan("Q")).toBeNull();
    expect(decodePlan(null)).toBeNull();
  });

  it("splits a plan into stints and adds a stop in the longest one", () => {
    const plan = { start: "MEDIUM" as const, stops: [{ lap: 20, compound: "HARD" as const }] };

    expect(planStints(plan, 70)).toEqual([
      { compound: "MEDIUM", from: 1, to: 20 },
      { compound: "HARD", from: 21, to: 70 },
    ]);
    expect(addStop(plan, 70, "MEDIUM").stops).toEqual([
      { lap: 20, compound: "HARD" },
      { lap: 46, compound: "MEDIUM" },
    ]);
  });

  it("spots stops out of order and stints too short", () => {
    expect(
      planProblem(
        {
          start: "MEDIUM",
          stops: [
            { lap: 30, compound: "HARD" },
            { lap: 20, compound: "HARD" },
          ],
        },
        70,
      ),
    ).toBe("order");
    expect(planProblem({ start: "MEDIUM", stops: [{ lap: 69, compound: "HARD" }] }, 70)).toBe(
      "short",
    );
    expect(planProblem({ start: "MEDIUM", stops: [{ lap: 30, compound: "HARD" }] }, 70)).toBeNull();
  });
});
