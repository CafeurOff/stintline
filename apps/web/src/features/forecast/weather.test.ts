import { weatherKind } from "./weather";

describe("weatherKind", () => {
  it.each([
    [0, "clear"],
    [2, "cloudy"],
    [3, "overcast"],
    [45, "fog"],
    [53, "drizzle"],
    [61, "rain"],
    [81, "rain"],
    [73, "snow"],
    [95, "storm"],
    [null, null],
  ])("reads WMO code %s as %s", (code, kind) => {
    expect(weatherKind(code)).toBe(kind);
  });
});
