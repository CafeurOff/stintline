/**
 * English copy. The source of truth for message keys: `fr.ts` must define every key
 * (enforced by its type). Placeholders use `{name}` and are filled by `t()`.
 */
export const en = {
  "app.skip": "Skip to content",
  "app.disclaimer":
    "Unofficial project, not associated with Formula 1, the FIA or any team. Data: OpenF1, Jolpica.",
  "nav.label": "Main",
  "nav.race": "Race",
  "nav.tyres": "Tyres",
  "nav.model": "How it works",
  "header.race": "Race",
  "header.language": "Language",
  "theme.toLight": "Switch to light theme",
  "theme.toDark": "Switch to dark theme",

  "api.checking": "Checking the server…",
  "api.online": "Server online · v{version}",
  "api.degraded": "Server degraded (database {database})",
  "api.unreachable": "Server unreachable",

  "common.retry": "Retry",
  "common.loading": "Loading…",
  "common.error": "Something went wrong",
  "common.clear": "Clear",
  "error.network": "Could not reach the server.",
  "error.throttled": "Too many simulations in a short time. Try again in a moment.",
  "error.unexpected": "The server sent an unexpected response.",

  "home.empty.title": "No race loaded yet",
  "home.empty.body": "Load the demo races with make seed, then reload this page.",
  "notFound.title": "Page not found",
  "notFound.back": "Back to the races",

  "map.title": "{circuit}: cars on track, lap {lap}",
  "map.noTrack": "No circuit drawing for this race. The simulations still work from the panel.",
  "replay.play": "Play",
  "replay.pause": "Pause",
  "replay.lap": "Lap {lap}",
  "replay.slider": "Lap",
  "replay.sliderValue": "Lap {lap} of {total}",
  "replay.speed": "Replay speed",
  "replay.finished": "Chequered flag",

  "panel.mode": "Simulation",
  "panel.mode.stop": "Pit stop",
  "panel.mode.undercut": "Undercut",
  "panel.driver": "Driver",

  "stop.question": "What if {name} pitted now?",
  "stop.running": "{position} · {compound} tyres, {age} laps old",
  "stop.go": "Simulate the stop",
  "stop.rejoin": "at the pit exit",
  "stop.between":
    "{code} would lose about {loss} and rejoin between {ahead} ({aheadGap} ahead) and {behind} ({behindGap} behind).",
  "stop.front": "{code} would lose about {loss} and stay ahead of {behind} ({behindGap} behind).",
  "stop.back": "{code} would lose about {loss} and rejoin behind {ahead} ({aheadGap} ahead).",
  "stop.close":
    "Close with {names}: a stop {sigma} quicker or slower changes the result. The light zone on the circuit shows that margin.",
  "stop.safe": "Nobody within {sigma}: this result is reliable.",
  "stop.cannot": "{name} cannot stop on this lap. Move the replay between lap 2 and lap {max}.",

  "undercut.question": "Can {attacker} undercut {defender}?",
  "undercut.leader": "{name} is leading: there is no car ahead to undercut.",
  "undercut.defender": "Car ahead",
  "undercut.tyres": "{code}'s new tyres",
  "undercut.reaction": "{code} reacts",
  "undercut.reaction.value": "{n} lap later",
  "undercut.reaction.values": "{n} laps later",
  "undercut.go": "Simulate the undercut",
  "undercut.works": "{attacker} would come out ahead",
  "undercut.fails": "{attacker} would stay behind",
  "undercut.detail":
    "Once both cars have stopped, {attacker} would be {gap} {side} {defender} (the gap is {before} now). Chance of coming out ahead: {p}.",
  "undercut.side.ahead": "ahead of",
  "undercut.side.behind": "behind",

  "tyres.title": "Tyres",
  "tyres.wear": "lose {ms} per lap",
  "tyres.fresh": "new: {time}",
  "tyres.rough": "few laps, rough estimate",
  "tyres.strategies": "Who ran what",
  "tyres.used": "* started on used tyres",
  "tyres.chart": "Lap time as the tyres age",
  "tyres.chartNote":
    "Each dot is a lap, corrected for the fuel burnt. The steeper the line, the faster the tyres wear.",
  "tyres.chartLabel":
    "Fuel-corrected lap time by tyre age for {drivers}, with the fitted trend of each stint.",
  "tyres.drivers": "Drivers",
  "tyres.age": "Tyre age (laps)",
  "tyres.noFit": "Not enough clean laps to measure tyre wear in this race.",
  "tyres.table": "Show as a table",
  "tyres.col.driver": "Driver",
  "tyres.col.stint": "Stint",
  "tyres.col.compound": "Tyres",
  "tyres.col.laps": "Laps",
  "tyres.col.wear": "Wear",

  "model.title": "How StintLine works",
  "model.intro":
    "StintLine reads the real timing of every lap. It removes the laps that say nothing about pace (start, pit laps, safety car, traffic), corrects for the fuel burnt, measures how fast each tyre wears and how much time a pit stop costs at each circuit. From there it estimates where a driver rejoins after a stop, with a margin of error.",
  "model.test.title": "Tested on races it never saw",
  "model.test.body":
    "{n} real pit stops from six 2025 races that were never used to tune the model: the predicted position was exact {exact} of the time and within one place {within} of the time.",
  "model.test.compare":
    "On average the prediction is off by {mae} places. Simply keeping the current position would be off by {baseline}.",
  "model.test.missing": "Test results are not available.",
  "model.details": "Settings and assumptions",
  "model.details.note": "Every assumption is a named setting with a justified value.",

  "compound.SOFT": "Soft",
  "compound.MEDIUM": "Medium",
  "compound.HARD": "Hard",
  "compound.INTERMEDIATE": "Intermediate",
  "compound.WET": "Wet",
  "compound.UNKNOWN": "Unknown",
  "compoundPlural.SOFT": "Softs",
  "compoundPlural.MEDIUM": "Mediums",
  "compoundPlural.HARD": "Hards",
  "compoundPlural.INTERMEDIATE": "Intermediates",
  "compoundPlural.WET": "Wets",
  "compoundPlural.UNKNOWN": "Unknown tyres",
  "compoundLower.SOFT": "soft",
  "compoundLower.MEDIUM": "medium",
  "compoundLower.HARD": "hard",
  "compoundLower.INTERMEDIATE": "intermediate",
  "compoundLower.WET": "wet",
  "compoundLower.UNKNOWN": "unknown",
} as const;

export type MessageKey = keyof typeof en;
