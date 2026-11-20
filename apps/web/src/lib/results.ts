import type { MessageKey } from "@/lib/i18n/en";
import type { Locale } from "@/lib/i18n/locale";

/** Classification codes of a car that did not finish classified (Jolpica `positionText`). */
export const OUT_CODES = ["R", "W", "D", "E", "N", "F"] as const;
export type OutCode = (typeof OUT_CODES)[number];

export function outCode(classification: string | null | undefined): OutCode | null {
  return OUT_CODES.find((code) => code === classification) ?? null;
}

/** Short label shown in the position column (DNF, DNS…), with the full one as a title. */
export function outShortKey(code: OutCode): MessageKey {
  return `result.short.${code}`;
}

/** Full label: Retired, Did not start, Disqualified… */
export function outLabelKey(code: OutCode): MessageKey {
  return `result.out.${code}`;
}

/** French names of the causes Jolpica gives for a retirement (the most frequent ones). */
const CAUSES_FR: Readonly<Record<string, string>> = {
  Accident: "Accident",
  Collision: "Collision",
  "Collision damage": "Dégâts de collision",
  "Spun off": "Tête-à-queue",
  Engine: "Moteur",
  "Power Unit": "Groupe propulseur",
  Gearbox: "Boîte de vitesses",
  Transmission: "Transmission",
  Suspension: "Suspension",
  Electrical: "Électrique",
  Electronics: "Électronique",
  Brakes: "Freins",
  Clutch: "Embrayage",
  Hydraulics: "Hydraulique",
  "Fuel system": "Circuit d'essence",
  "Fuel pressure": "Pression d'essence",
  "Fuel pump": "Pompe à essence",
  "Fuel leak": "Fuite d'essence",
  "Out of fuel": "Panne d'essence",
  Turbo: "Turbo",
  Overheating: "Surchauffe",
  Ignition: "Allumage",
  "Oil leak": "Fuite d'huile",
  "Oil pressure": "Pression d'huile",
  "Water leak": "Fuite d'eau",
  "Water pressure": "Pression d'eau",
  Throttle: "Accélérateur",
  Halfshaft: "Demi-arbre",
  Driveshaft: "Arbre de transmission",
  Wheel: "Roue",
  "Wheel nut": "Écrou de roue",
  "Wheel bearing": "Roulement de roue",
  Tyre: "Pneu",
  Puncture: "Crevaison",
  Differential: "Différentiel",
  Handling: "Tenue de route",
  Steering: "Direction",
  Radiator: "Radiateur",
  Exhaust: "Échappement",
  Chassis: "Châssis",
  Mechanical: "Mécanique",
  "Power loss": "Perte de puissance",
  Vibrations: "Vibrations",
  "Broken wing": "Aileron cassé",
  "Rear wing": "Aileron arrière",
  "Heat shield fire": "Feu de l'écran thermique",
  Battery: "Batterie",
  Physical: "Raison physique",
  Injury: "Blessure",
  "Driver unwell": "Pilote malade",
  Retired: "Abandon",
  Withdrew: "Retrait",
  Disqualified: "Disqualifié",
  "Did not start": "Non partant",
  "Not classified": "Non classé",
};

/** Statuses that only repeat what the classification code already says. */
const SAME_AS_CODE = new Set([
  "Retired",
  "Did not start",
  "Withdrew",
  "Disqualified",
  "Not classified",
  "Excluded",
  "Finished",
  "Lapped",
]);

/**
 * The cause behind a status (Accident, Gearbox…) in the reader's language, or null when the
 * status says nothing more than the code (Retired) or is a lap count (+1 Lap).
 */
export function outCause(status: string | null | undefined, locale: Locale): string | null {
  if (!status || SAME_AS_CODE.has(status) || /^\+\d+ Laps?$/.test(status)) return null;
  return locale === "fr" ? (CAUSES_FR[status] ?? status) : status;
}
