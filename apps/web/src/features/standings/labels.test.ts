import { spreadLabels } from "./labels";

describe("spreadLabels", () => {
  it("keeps labels that are already apart", () => {
    expect(spreadLabels([10, 50, null], 12)).toEqual([10, 50, null]);
  });

  it("pushes overlapping labels apart in their vertical order", () => {
    expect(spreadLabels([20, 15, 16], 12)).toEqual([39, 15, 27]);
  });
});
