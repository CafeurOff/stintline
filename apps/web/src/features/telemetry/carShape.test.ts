import { ARMS, CHASSIS, loft, SECTION_POINTS, WHEELS } from "./carShape";

describe("car shape", () => {
  it("lofts one closed volume through its sections", () => {
    const { positions, indices } = loft(CHASSIS);

    expect(positions).toHaveLength((CHASSIS.length * SECTION_POINTS + 2) * 3);
    // Sides between rings, plus a cap at each end.
    expect(indices).toHaveLength((CHASSIS.length - 1) * SECTION_POINTS * 6 + SECTION_POINTS * 6);
    expect(Math.max(...indices)).toBe(CHASSIS.length * SECTION_POINTS + 1);
  });

  it("follows each section's width and height", () => {
    const { positions } = loft([
      { x: 1, halfWidth: 0.5, bottom: 0, top: 1 },
      { x: -1, halfWidth: 0.5, bottom: 0, top: 1 },
    ]);

    const zs = positions.filter((_, i) => i % 3 === 2);
    const ys = positions.filter((_, i) => i % 3 === 1);
    expect(Math.max(...zs)).toBeCloseTo(0.5);
    expect(Math.max(...ys)).toBeCloseTo(1);
    expect(Math.min(...ys)).toBeCloseTo(0);
  });

  it("faces outwards", () => {
    const { positions, indices } = loft(CHASSIS);
    const at = (i: number) => [
      positions[i * 3] ?? 0,
      positions[i * 3 + 1] ?? 0,
      positions[i * 3 + 2] ?? 0,
    ];
    const [a, b, c] = [at(indices[0] ?? 0), at(indices[1] ?? 0), at(indices[2] ?? 0)];
    const u = [(b[0] ?? 0) - (a[0] ?? 0), (b[1] ?? 0) - (a[1] ?? 0), (b[2] ?? 0) - (a[2] ?? 0)];
    const v = [(c[0] ?? 0) - (a[0] ?? 0), (c[1] ?? 0) - (a[1] ?? 0), (c[2] ?? 0) - (a[2] ?? 0)];
    const normalZ = (u[0] ?? 0) * (v[1] ?? 0) - (u[1] ?? 0) * (v[0] ?? 0);

    // The first face is on the car's left flank (+z): its normal points to +z.
    expect(normalZ).toBeGreaterThan(0);
  });

  it("joins every wheel to the body with two arms", () => {
    expect(ARMS).toHaveLength(WHEELS.length * 2);
    expect(ARMS.every((arm) => Math.abs(arm.to[2]) > Math.abs(arm.from[2]))).toBe(true);
  });
});
