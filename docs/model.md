# Strategy model

How StintLine turns timing data into strategy answers, which assumptions it makes, and how well it performs on real 2025 races. The code lives in `packages/strategy` (`stintline_strategy`), a framework-free package with no I/O. Every assumption below is a named parameter of a frozen config dataclass, so it can be changed and re-validated.

> **Status (2026-11-03).** Pit-exit predictions are validated on 6 held-out races. Degradation and undercut models are verified on synthetic ground truth and checked for physical plausibility on 9 races, but not yet backtested against real undercut outcomes.

## 1. Pipeline

```
laps ──► cleaning ──► fuel correction ──► degradation (stint, compound) ──► pace model ─┐
pit stops + laps ──► pit loss per circuit ──────────────────────────────────────────────┼─► undercut / overcut
gaps at decision lap ───────────────────────────────────────────────────────────────────┴─► pit-exit position
compound models + pit loss ──► optimal 1- or 2-stop window
```

## 2. Assumptions

| Parameter | Default | Where | Justification |
| --- | --- | --- | --- |
| `CleaningConfig.exclude_first_lap` | `True` | `laps.py` | Standing start and first-lap traffic are not tyre pace. |
| `CleaningConfig.restart_buffer_laps` | 1 | `laps.py` | Cold tyres and a bunched field on the lap after a SC, VSC or red flag. |
| `CleaningConfig.outlier_k` | 3.0 | `laps.py` | Residual > 3 robust σ from the stint's local pace is traffic, a mistake or blue flags. Keeps 99.7 % of laps under Gaussian noise. |
| `CleaningConfig.rolling_window_laps` | 5 | `laps.py` | Local pace = centred rolling median. It follows degradation, and one bad lap cannot move it. A straight-line trend wrongly flagged the ends of curved stints (found by a test). |
| `CleaningConfig.outlier_min_sigma_s` | 0.15 s | `laps.py` | Floor so very consistent stints do not lose normal noise. |
| `FuelModel.seconds_per_kg` | 0.033 s/kg | `fuel.py` | Most cited figure (0.3 to 0.35 s per 10 kg). Sensitivity below. |
| `FuelModel.start_fuel_kg` | 100 kg | `fuel.py` | 2025 limit is 110 kg, and teams start lighter and save fuel. |
| Fuel burn | `start_fuel / total_laps` | `fuel.py` | Race distance is fixed, so burn per lap scales with lap length: gain is 0.047 s/lap at the Hungaroring and 0.062 s/lap at Monza. |
| `DegradationConfig.min_laps` | 5 | `degradation.py` | Fewer clean laps give unstable slopes. |
| `DegradationConfig.quadratic_aic_margin` | 2 | `degradation.py` | Usual threshold for meaningful support (Burnham & Anderson). |
| `DegradationConfig.min_curvature_effect_s` | 0.15 s | `degradation.py` | AIC alone chose a quadratic on 7 % of purely linear simulated stints (400 trials). Requiring the curve to depart ≥ 0.15 s from its chord drops this to 0–1 % and still detects real curvature (100 % detection for c₂ = 0.002 over 25+ laps). |
| `DegradationConfig.confidence` | 0.95 | `degradation.py` | Interval level, verified calibrated (95 % ± 5 % over 200 simulated stints). |
| `PitLossConfig.reference_window_laps` | 5 | `pit_loss.py` | Car's own clean pace on each side of the stop. |
| `PitLossConfig.outlier_k` | 3.0 | `pit_loss.py` | Drops penalties served in the box, slow stops and damage. |
| `PitLossConfig.sc_factor` | 0.7 | `pit_loss.py` | Used only when no SC stop was observed. Measured 0.74 at Bahrain 2025 (17.0 s vs 23.1 s). The initial guess of 0.55 was refuted by the data. |
| `PitLossConfig.vsc_factor` | 0.8 | `pit_loss.py` | Assumption: no VSC stop in the reference set. |
| `PitExitConfig.gap_noise_s_per_lap` | 1.5 s | `pit_exit.py` | Calibrated on the reference races (see §4). Pure pace noise is ~0.4 s, and in/out-lap traffic adds the rest. |
| `PitExitConfig.interval` | 0.9 | `pit_exit.py` | Reported position interval. |
| Rival stop share | 0.5 | `pit_exit.py` | A rival that pitted on the decision lap still has its out-lap (≈ half its loss) to run. |
| `WindowConfig.min_stint_laps` | 5 | `window.py` | Shorter stints are never strategic. |
| `WindowConfig.window_tolerance_s` | 1.0 s | `window.py` | Plans within 1 s of the best are treated as equivalent. |
| `WhatIfConfig.min_stint_laps` | 3 | `whatif.py` | A stop every two laps is never a plan; shorter stints are rejected. |
| `WhatIfConfig.long_stint_margin_laps` | 3 | `whatif.py` | Stints longer than the longest run on that compound in the race (+ 3 laps) are extrapolated: a warning is shown. |
| `WhatIfConfig.require_two_dry_compounds` | `True` | `whatif.py` | Dry-race rule: a single-compound plan is flagged as illegal (still simulated). |
| `TelemetryConfig.step_m` | 10 m | `telemetry.py` | Resampling step: keeps the shortest braking zones (~40 m), 500 points for a 5 km lap. |
| `TelemetryConfig.min_brake_s` | 0.3 s | `telemetry.py` | Shorter brake signals are dabs or noise (one sample is ~0.27 s at 3.7 Hz). |
| `TelemetryConfig.merge_gap_m` | 30 m | `telemetry.py` | Release and re-apply in the same corner count as one braking zone. |
| `TelemetryConfig.max_samples_gap_s` | 2 s | `telemetry.py` | A longer hole in the car data would misplace every later point: the lap is refused. |
| Full throttle | ≥ 99 % | `telemetry.py`, web | The feed rarely reports exactly 100 % on straights. |
| `MIN_START_GAIN` / `MIN_START_LOSS` | 2 / 3 places | `news/story.py` | Lap-1 moves worth a sentence in a race report. |
| `UNDERCUT_WINDOW_LAPS` | 5 | `news/story.py` | The winner's stop counts as an undercut when it came at most 5 laps before the stop of the car it passed. |
| `PaceFilter.cutoff_pct` | 107 % | `analysis.py` | Race pace charts drop laps slower than 107 % of the race's fastest lap (the qualifying rule fans know). The user can change it or turn it off. Lap 1 is never kept. |
| `WHISKER_IQR` | 1.5 | `analysis.py` | Tukey's convention for box-plot whiskers and outliers. |
| `ConsistencyConfig.min_stint_laps` | 4 | `analysis.py` | A straight line through fewer clean laps absorbs the scatter it should measure. |
| `ConsistencyConfig.min_laps` | 8 | `analysis.py` | Clean laps needed for a consistency figure. |
| `UndercutConfig.max_gap_s` | 3.0 s | `analysis.py` | An early stop counts as an undercut attempt only within 3 s of the car ahead: about the most a new-tyre out-lap and the rival's slower in-lap can make up. |
| `UndercutConfig.max_reply_laps` | 3 | `analysis.py` | The car ahead must pit within 3 laps, or the stops are unrelated. |
| `MIN_CLEAN_LAPS` | 5 | `analysis/build.py` | Clean laps a car needs before its median race pace is stored. |
| `MIN_STATIONARY_S` | 1.6 s | `analysis/build.py` | Faster stationary times are timing glitches (the record is about 1.8 s). |
| `MIN_RACES` | 3 | `analysis/season.py` | Races with a consistency figure a driver needs to be ranked over a season. |

## 3. Methods

**Lap cleaning.** Each lap is kept or excluded with a reason: `missing_time`, `first_lap`, `pit_in`, `pit_out`, `neutralised`, `restart` or `outlier`. Neutralised laps come from race control (SC deployed, then "SAFETY CAR IN THIS LAP", then "TRACK CLEAR"). On real data, about 80 % of laps are kept (Hungary: 1,163 of 1,369, with 127 outliers in a traffic-heavy race).

**Fuel correction.** Each lap time is expressed at an empty tank: `t − k · fuel_on_board(lap)`, with fuel evaluated at mid-lap.

**Degradation per stint.** OLS of the corrected time on tyre age (the age when fitted is taken from the data, since used sets are common). The quadratic is chosen only with AIC support *and* practical curvature. The slope is reported at the stint's mean age with a t-interval, with R² and RMSE.

**Degradation per compound.** Within-stint (fixed-effects) estimator: each stint is centred on its own mean, so faster cars running longer stints do not bias the slope. This is tested with a synthetic field where pace and stint length are correlated.

**Pit loss.** For a green stop, `in-lap + out-lap − 2 × median clean pace in ±5 laps`. The measured value therefore already includes the out-lap benefit of new tyres, which is what a strategist needs. Under SC or VSC, the reference is the median of cars that did not pit on those laps, because everyone runs the same delta time. Outliers above 3 robust σ are flagged. The circuit value is the median, and the spread is the MAD-based σ.

**Pit-exit position.** At the end of lap L−1, for each car on the same lap, `margin = gap − pit_loss`. P(still ahead) = Φ(margin / σ), with σ² = σ_pitloss² + 2 σ_gap². The rejoin position follows a Poisson-binomial distribution, computed exactly by convolution, which gives the expected value, the mode and a 90 % interval. In *scenario mode*, rivals declared as stopping in the same window carry their own loss.

**Undercut / overcut.** Both cars are simulated lap by lap with `pace = car offset + compound pace(age)`. Each stop adds the measured pit loss. The out-lap runs at old-tyre pace, because the new-tyre benefit is already inside the measured loss, and new tyres count from the next lap. The output is the gap after both stops, the net gain, and P(attacker ahead) from σ² = 2 σ_pitloss² + propagated slope uncertainty.

**Optimal window.** Exhaustive search over 1- and 2-stop plans, using the closed-form stint cost `n · pace₀ + slope · Σ ages`. It enforces the two-dry-compounds rule, optional maximum stint length, and returns every plan within 1 s of the best.

**What-if replay of a whole race (ADR 0010).** The car's real race is kept and only the modelled effect of the change is added, lap by lap: `alt(lap) = real(lap) + Σ_{k ≤ lap} [tyre delta(k) + stop delta(k)]`. The tyre delta is the compound pace at the alternative age minus the pace at the real age (the car offset and fuel cancel), zero on neutralised laps. Each added stop adds the loss expected under that lap's conditions (`PitLossEstimate.under`), each removed real stop takes it back. Both schedules use the same convention: new set from the lap after the in-lap. The finishing order uses the official race times (with penalties) of the other cars, which do not change. σ² = Σ σ_pitloss² over the added and removed stops + Σ_compound (slope SE × net tyre age on that compound)², the slope error being shared by every lap on the compound. The finishing position is a distribution: P(between two rival times) from the Normal CDF.

**Lap telemetry (ADR 0013).** One lap of car data (speed, throttle, brake on/off, gear, DRS, about 3.7 Hz) and positions. Distance is the trapezoidal integral of speed, the first sample extrapolated back to the line at its own speed and the last one forward to the end of the lap. Two laps are compared on the fraction of the lap, stretched to their mean length, so corners line up even though integrated lengths differ by up to ~1 %. Time at each point is interpolated on the same fraction; the gap between two drivers at a point is the difference of those times. Braking zones are runs of the brake channel, merged when closer than 30 m and kept when longer than 0.3 s; the apex speed is the lowest speed before the next full-throttle application. On the 2025 Hungarian Grand Prix the integrated lap is 4,342 m (official 4,381 m), Norris's fastest lap shows 10 braking zones (turn 1: 275 → 88 km/h) and the gap to Piastri ends at −0.506 s, the exact difference of their lap times.

**Race story (ADR 0012, 0013).** The running order at the end of each lap comes from line-crossing times. Lead spells, laps led and lap-1 moves follow directly. The winner's last change of lead is classed as: led every lap; regained after the pit cycle (the winner led, stopped, and the car that stayed out stopped one or two laps before the lead came back); undercut (the winner stopped up to 5 laps before the stop of the car that led); inherited at a rival's stop; or on track.

**Analysis figures (ADR 0017).** Stored once per race. *Race pace* is the median of the fuel-corrected clean laps, compared with the median of all cars (field) or with a teammate; the race pace chart lets the user change the lap filter. *Consistency* is the robust σ (MAD × 1.4826) of the residuals once each stint's straight-line trend is removed, so tyre wear does not count as inconsistency. *Passes* are order changes at the line between two consecutive green laps where neither car pitted on either lap. *Undercut attempts*: car A pits on lap L within 3 s of the car directly ahead, B, which pits within the next 3 laps; the undercut worked when A is ahead at the end of B's out-lap. Stops on or just before a neutralised lap are left out. On the 2025 season this finds 54 attempts, 23 of which worked.

## 4. Validation

### 4.1 Synthetic ground truth (unit tests)
- Degradation slopes recovered inside their 95 % interval. Interval coverage is 90–99 % over 200 stints, linear and quadratic.
- Pooled compound slope unbiased when pace and stint length are correlated.
- Pit loss recovered within 1 s, and SC pit loss within 2.5 s.
- Undercut gain matches the hand calculation (0.15 s/lap × 26 laps − 0.4 s compound offset ≈ 3.5 s).

**What-if.** Two synthetic races generated with the same seed differ only in one car's strategy, so every lap draws the same noise and the second race is the exact answer for "the first race with the second strategy". The replay matches it within max(1 s, 2σ) for later and earlier one-stops, a two-stop, and stops under or outside a Safety Car (`tests/test_whatif.py`). On the real Hungarian Grand Prix 2025, swapping Norris's one-stop and Piastri's two-stop moves each by about 1.4 s (σ ≈ 3.7 s), consistent with the 0.7 s that separated them.

### 4.2 Pit-exit backtest on real 2025 races
`manage.py seed_demo --backtest && manage.py backtest`. Each measurable green stop is predicted with the pit loss estimated from the *other* stops of the race (leave-one-out). It is compared with the observed position at the end of the out-lap. Stops under or next to a neutralisation, on lap 1 or on the final lap are skipped.

- **Parameter choice** used only Bahrain, Hungary and Italy (reference set).
- **Japan, Spain, Austria, Netherlands, Mexico City and Abu Dhabi were never used for tuning** (held-out set).

| Set | Mode | Stops | MAE (positions) | Exact | Within ±1 | 90 % interval coverage | Baseline MAE* |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Reference | blind | 76 | 0.88 | 50 % | 74 % | 70 % | 6.07 |
| Reference | scenario | 76 | 0.58 | 58 % | 87 % | 88 % | 6.07 |
| **Held-out** | **blind** | 155 | **0.86** | 49 % | 79 % | 66 % | 4.68 |
| **Held-out** | **scenario** | 155 | **0.66** | 48 % | **90 %** | **86 %** | 4.68 |

\* Baseline: the car keeps the position it had before stopping.

Per-race tables are in `apps/api/stintline/strategy_api/data/backtest-2025-reference.json` and `backtest-2025-held-out.json` (also served on the model page).

**Reading the results.**
- **The model generalises.** Held-out MAE (0.86 / 0.66) matches the reference set (0.88 / 0.58), so there is no sign of overfitting.
- **Blind mode** assumes rivals stay out, which is all a strategist knows for certain. Its errors are dominated by rivals stopping in the same window. On reference stops where no rival pitted within one lap, MAE falls to 0.56 and interval coverage reaches 89 %.
- **Scenario mode** gives the model the rival stops (as a strategist would when modelling a cover) and isolates the model's own error.
- **Calibration.** `gap_noise_s_per_lap` was raised from 0.4 to 1.5 s on the reference set. Coverage went from 76 % to 87 % with MAE unchanged, and it holds out of sample (86 %).
- **Weakest race: Japan** (MAE 1.0 to 1.5). Most cars ran a one-stop in a narrow window, so many simultaneous stops reshuffle the order.

### 4.3 Physical plausibility of degradation (pooled slope, s/lap, 95 % CI)

| Race | Laps | Soft | Medium | Hard | Pit loss |
| --- | --- | --- | --- | --- | --- |
| Bahrain | 57 | +0.139 [0.129, 0.148] | +0.106 [0.100, 0.112] | +0.118 [0.111, 0.125] | 23.0 ± 1.5 s |
| Hungary | 70 | +0.101 [0.057, 0.145] | +0.047 [0.042, 0.052] | +0.045 [0.040, 0.049] | 21.3 ± 2.1 s |
| Italy (Monza) | 53 | n = 3 stints, inconclusive | +0.019 [0.016, 0.022] | +0.015 [0.013, 0.017] | 25.3 ± 0.8 s |
| Japan | 53 | +0.058 [0.030, 0.086] | +0.034 [0.030, 0.037] | +0.019 [0.016, 0.022] | 23.4 ± 1.3 s |
| Spain | 66 | +0.095 [0.086, 0.104] | +0.062 [0.056, 0.069] | — | 22.3 ± 1.6 s |
| Austria | 70 | +0.099 [0.040, 0.158] | +0.074 [0.069, 0.078] | +0.064 [0.060, 0.068] | 21.4 ± 1.4 s |
| Netherlands | 72 | +0.060 [0.050, 0.071] | +0.046 [0.040, 0.053] | +0.041 [0.037, 0.045] | 18.0 ± 1.9 s |
| Mexico City | 71 | +0.067 [0.063, 0.072] | +0.054 [0.050, 0.058] | n = 2 stints | 22.2 ± 1.5 s |
| Abu Dhabi | 58 | n = 2 stints, inconclusive | +0.099 [0.093, 0.106] | +0.043 [0.039, 0.046] | 22.7 ± 1.9 s |

Bahrain (abrasive, hot) is the highest-degradation race and Monza the lowest. Softs degrade faster than mediums and hards wherever enough stints exist. Compounds with fewer than 3 stints have intervals too wide to use and are flagged as low confidence.

### 4.4 Fuel sensitivity
Pooled slopes on the reference races for three fuel effects:

| s/kg (gain per lap at Bahrain) | Bahrain M / H | Hungary M / H | Monza M / H |
| --- | --- | --- | --- |
| 0.022 (0.039) | +0.087 / +0.099 | +0.031 / +0.029 | **−0.002 / −0.006** |
| **0.033 (0.058)** | +0.106 / +0.118 | +0.047 / +0.045 | +0.019 / +0.015 |
| 0.044 (0.077) | +0.125 / +0.137 | +0.063 / +0.060 | +0.040 / +0.036 |

Each ±0.011 s/kg shifts slopes by about ±0.019 s/lap. 0.022 s/kg yields negative wear at Monza (tyres getting faster with age), which is physically implausible. This supports the default and the literature value.

## 5. Limitations
- **Rival reactions are not predicted.** Blind mode assumes rivals stay out, and scenario mode needs them as input. A rival-stop probability model is future work.
- **Under a Safety Car** the current gaps are used, and field compression is not modelled. Neutralised stops are excluded from the backtest.
- **Linear compound model** in the undercut simulator and the window search: tyre "cliffs" are not extrapolated. Per-stint fits may be quadratic, and many Hungarian stints are, which reflects track evolution and traffic that the fuel model does not capture.
- **Track evolution** (rubbering-in) is absorbed into the fuel and degradation terms.
- **Traffic** is not modelled explicitly beyond outlier removal.
- **Undercut and window** are verified on synthetic data and physically plausible inputs, but not yet backtested against observed undercut outcomes. This is planned once enough pairwise exchanges are labelled.
- **What-if: the other cars do not react** to the new strategy, and overtaking on track costs nothing: a car that rejoins behind a slower one is assumed to pass at once. The car's own traffic and mistakes stay as they were in the real race. Retired cars, cars with gaps in their timing and wet races cannot be replayed.
- **Pit loss under a Safety Car** can be overestimated when a stop's out-lap falls under the SC (the slow SC lap inflates the measured loss). Found with the what-if tests; affects circuits where the field pitted just before a Safety Car.
- **Telemetry** is sampled at ~3.7 Hz: a brief lift or a short brake application can fall between two samples, and minimum speeds are rounded to the nearest sample. Integrated distance drifts by about 1 % per lap, which is why laps are compared by fraction of lap. Only the fastest clean lap of each driver is stored.
- **Race story** classes the decisive moment from positions at the line only: an overtake in the pit lane or a position given back under orders reads as "on track".
- **Analysis figures** read positions at the line only: a pass made and lost within a lap is not seen, and races whose timing has no lap start times (Miami 2025) have no passes or laps led. Degradation from wet races is left out of the track DNA.
- **Sample size.** Nine dry 2025 races. Wet races, Qatar-style stint limits and sprint races are not part of the validation.
