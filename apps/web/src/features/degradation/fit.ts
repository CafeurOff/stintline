/** Polynomial fit `c0 + c1·age + c2·age²…` evaluated at a tyre age. */
export function evaluateFit(coefficients: readonly number[], age: number): number {
  return coefficients.reduce((sum, c, power) => sum + c * age ** power, 0);
}
