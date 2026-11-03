import { compoundInfo } from "./compounds";
import { inkOn, teamColour } from "./teams";

describe("compoundInfo", () => {
  it("maps known compounds case-insensitively", () => {
    expect(compoundInfo("medium")).toMatchObject({ letter: "M", label: "Medium" });
  });

  it("maps unknown and missing compounds to UNKNOWN", () => {
    expect(compoundInfo("HYPERSOFT").key).toBe("UNKNOWN");
    expect(compoundInfo(null).letter).toBe("?");
  });
});

describe("teamColour", () => {
  it("normalises API hex colours", () => {
    expect(teamColour("F47600")).toBe("#f47600");
    expect(teamColour("#27F4D2")).toBe("#27f4d2");
  });

  it("falls back to a neutral grey", () => {
    expect(teamColour("")).toBe("#8a8984");
    expect(teamColour(undefined)).toBe("#8a8984");
  });
});

describe("inkOn", () => {
  it("picks dark ink on light colours and white on dark ones", () => {
    expect(inkOn("#f2c94c")).toBe("#1c1b19");
    expect(inkOn("#1e41ff")).toBe("#ffffff");
    expect(inkOn("not-a-colour")).toBe("#ffffff");
  });
});
