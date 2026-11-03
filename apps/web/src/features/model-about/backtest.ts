/**
 * The model card's `backtest` field is free-form JSON in the schema (it mirrors the
 * engine's report files). These guards narrow it to the shape the page renders and ignore
 * anything else, so a report format change degrades to "not available" instead of a crash.
 */
export interface BacktestMetrics {
  n: number;
  mae: number;
  exact_rate: number;
  within_one_rate: number;
  interval_coverage: number;
  baseline_mae: number;
}

export interface BacktestMode {
  overall: BacktestMetrics;
  perRace: [string, BacktestMetrics][];
}

export interface BacktestRaceSet {
  blind: BacktestMode | null;
  scenario: BacktestMode | null;
}

const METRIC_KEYS = [
  "n",
  "mae",
  "exact_rate",
  "within_one_rate",
  "interval_coverage",
  "baseline_mae",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toMetrics(value: unknown): BacktestMetrics | null {
  if (!isRecord(value)) return null;
  const metrics: Partial<Record<(typeof METRIC_KEYS)[number], number>> = {};
  for (const key of METRIC_KEYS) {
    const field = value[key];
    if (typeof field !== "number") return null;
    metrics[key] = field;
  }
  return metrics as BacktestMetrics;
}

function toMode(value: unknown): BacktestMode | null {
  if (!isRecord(value)) return null;
  const overall = toMetrics(value.overall);
  if (!overall) return null;
  const perRace: [string, BacktestMetrics][] = [];
  if (isRecord(value.per_race)) {
    for (const [race, raw] of Object.entries(value.per_race)) {
      const metrics = toMetrics(raw);
      if (metrics) perRace.push([race, metrics]);
    }
  }
  perRace.sort(([a], [b]) => a.localeCompare(b));
  return { overall, perRace };
}

/** Reads one race set (`reference` or `held-out`) from the model card's backtest map. */
export function readBacktest(
  backtest: Record<string, unknown>,
  set: string,
): BacktestRaceSet | null {
  const value = backtest[set];
  if (!isRecord(value)) return null;
  const blind = toMode(value.blind);
  const scenario = toMode(value.scenario);
  return blind || scenario ? { blind, scenario } : null;
}
