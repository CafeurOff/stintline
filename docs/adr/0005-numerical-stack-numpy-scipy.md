# 0005. Numerical stack for the strategy engine: numpy and scipy

- Status: Accepted
- Date: 2026-11-03

## Context
`packages/strategy` must stay framework-free ("pure Python" means no Django and no I/O). It needs:
- least squares with parameter covariance;
- Student-t and normal quantiles;
- robust statistics;
- a Poisson-binomial convolution.

Hand-written numerics would be longer, slower and less trustworthy than battle-tested libraries.

## Options considered
1. **Standard library only.** No dependencies, but re-implementing OLS covariance, t-quantiles and the normal CDF is error-prone and untested.
2. **numpy + scipy (chosen).** De facto standard, fully typed (`scipy-stubs`), vectorised, with well-known numerical behaviour.
3. **statsmodels.** Rich regression output, but heavy (pandas, patsy) for what is needed.

## Decision
`numpy` (linear algebra, arrays) and `scipy.stats` (t and normal distributions) are the only runtime dependencies of `stintline_strategy`. `scipy-stubs` keeps mypy strict.

## Consequences
- Positive: Correct statistics with little code. Fast enough for exhaustive pit-window search and per-request simulations.
- Negative: About 60 MB of wheels in the API image, which is acceptable.
- Rule: no pandas in the engine. Inputs and outputs stay frozen dataclasses.
