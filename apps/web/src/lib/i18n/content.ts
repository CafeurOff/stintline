import eventNamesFr from "./event-names.fr.json";
import type { Locale } from "./locale";

/**
 * French names of the Grands Prix, keyed by the API (Jolpica) English name. The JSON is shared
 * with the API, which writes the French page titles (ADR 0025).
 */
const EVENT_NAMES_FR: Readonly<Record<string, string>> = eventNamesFr;

/** Event name in the reader's language, falling back to the API name. */
export function eventName(name: string, locale: Locale): string {
  return locale === "fr" ? (EVENT_NAMES_FR[name] ?? name) : name;
}

const GROUPS_FR: Record<string, string> = {
  "Lap cleaning": "Tri des tours",
  Fuel: "Carburant",
  Degradation: "Usure des pneus",
  "Pit loss": "Perte au stand",
  "Pit exit": "Sortie des stands",
  "Pit window": "Fenêtre d'arrêt",
  "What-if": "Et si",
};

/**
 * Plain French versions of the engine's assumption descriptions, keyed by
 * `group/name` (names repeat across groups). English uses the API text as is.
 */
const ASSUMPTIONS_FR: Record<string, string> = {
  "Lap cleaning/exclude_first_lap":
    "Le tour 1 est écarté : il contient le départ arrêté et le trafic du premier tour.",
  "Lap cleaning/restart_buffer_laps":
    "Tours écartés après une neutralisation. Pneus et freins sont froids et le peloton est groupé à la relance.",
  "Lap cleaning/outlier_k":
    "Un tour est aberrant quand il s'écarte de la médiane glissante du relais de plus de k écarts robustes. Avec k = 3, on garde 99,7 % des tours normaux et on écarte trafic, erreurs et drapeaux bleus.",
  "Lap cleaning/outlier_min_sigma_s":
    "Écart minimal retenu, pour qu'un relais très régulier ne signale pas comme aberrant un bruit normal de 0,1 s.",
  "Lap cleaning/min_laps_for_outliers":
    "En dessous de ce nombre de tours, la tendance est trop incertaine pour écarter quoi que ce soit.",
  "Lap cleaning/rolling_window_laps":
    "Largeur de la médiane glissante qui sert de rythme local. Cinq tours suivent bien l'usure, et un seul mauvais tour ne la fait pas bouger.",
  "Fuel/seconds_per_kg":
    "Temps perdu par kilo de carburant embarqué. 0,033 s/kg, le chiffre le plus cité par les écuries et les ingénieurs (0,3 à 0,35 s pour 10 kg).",
  "Fuel/start_fuel_kg":
    "Carburant au départ. Le règlement 2025 limite à 110 kg ; les équipes partent en général plus léger et économisent, d'où 100 kg.",
  "Fuel/burn_mid_lap":
    "La charge de carburant est évaluée au milieu du tour plutôt qu'à son début.",
  "Degradation/min_laps":
    "Tours propres nécessaires pour mesurer l'usure d'un relais. Moins de tours donnent des pentes instables.",
  "Degradation/min_laps_quadratic":
    "Tours propres nécessaires avant d'envisager une usure qui s'accélère (courbe plutôt que droite).",
  "Degradation/quadratic_aic_margin":
    "La courbe doit expliquer nettement mieux les tours que la droite (écart d'AIC d'au moins 2, le seuil usuel).",
  "Degradation/min_curvature_effect_s":
    "La courbure doit aussi compter en pratique : au milieu du relais, la courbe doit s'écarter de la droite d'au moins cette valeur.",
  "Degradation/confidence": "Niveau de confiance des intervalles affichés.",
  "Pit loss/reference_window_laps":
    "Tours propres de part et d'autre de l'arrêt qui servent de rythme de référence.",
  "Pit loss/min_reference_laps":
    "Nombre minimal de tours propres pour faire confiance à cette référence.",
  "Pit loss/outlier_k":
    "Les arrêts trop éloignés de la médiane sont écartés (pénalité purgée au stand, arrêt lent, dégâts).",
  "Pit loss/min_sigma_s":
    "Écart minimal annoncé. Même les équipes les plus régulières varient de quelques dixièmes.",
  "Pit loss/sc_factor":
    "Part de la perte normale retenue sous safety car quand aucun arrêt sous SC n'a été observé : le peloton roule plus lentement, l'arrêt coûte moins. Mesuré à 0,74 à Bahreïn 2025, d'où 0,7.",
  "Pit loss/vsc_factor":
    "Même chose sous voiture de sécurité virtuelle. Les voitures roulent plus près du rythme de course, le gain est plus faible. 0,8 est une hypothèse.",
  "Pit exit/gap_noise_s_per_lap":
    "Variation typique de l'écart entre deux voitures sur un tour autour d'un arrêt. Réglé à 1,5 s sur les courses de référence pour que l'intervalle à 90 % soit juste, et vérifié sur les courses de test.",
  "Pit exit/interval": "Probabilité couverte par l'intervalle de position affiché.",
  "Pit window/min_stint_laps":
    "Relais le plus court autorisé : plus court, il n'a jamais d'intérêt stratégique.",
  "Pit window/max_stint_laps":
    "Relais le plus long autorisé (limites de pneus imposées, comme au Qatar 2023). Aucune limite par défaut.",
  "What-if/min_stint_laps":
    "Relais le plus court accepté dans une stratégie rejouée : s'arrêter tous les deux tours n'a jamais de sens.",
  "What-if/long_stint_margin_laps":
    "Marge au-delà du plus long relais couru avec une gomme dans la course : plus long, l'usure est extrapolée et un avertissement s'affiche.",
  "What-if/require_two_dry_compounds":
    "Règle des courses sur le sec : une stratégie avec une seule gomme est signalée comme interdite.",
  "Pit window/require_two_dry_compounds":
    "Règle des courses sur le sec : deux gommes différentes doivent être utilisées.",
};

export function assumptionGroup(group: string, locale: Locale): string {
  return locale === "fr" ? (GROUPS_FR[group] ?? group) : group;
}

export function assumptionText(
  group: string,
  name: string,
  english: string,
  locale: Locale,
): string {
  return locale === "fr" ? (ASSUMPTIONS_FR[`${group}/${name}`] ?? english) : english;
}

/** French names of the session labels the FIA writes in stewards' decisions. */
const FIA_SESSIONS_FR: Readonly<Record<string, string>> = {
  Race: "Course",
  Sprint: "Sprint",
  Qualifying: "Qualifications",
  "Sprint Qualifying": "Qualifications sprint",
  "Sprint Shootout": "Qualifications sprint",
  "Free Practice 1": "Essais libres 1",
  "Free Practice 2": "Essais libres 2",
  "Free Practice 3": "Essais libres 3",
  "Practice 1": "Essais libres 1",
  "Practice 2": "Essais libres 2",
  "Practice 3": "Essais libres 3",
  "Reconnaissance Laps": "Tours de reconnaissance",
  "Grid Procedure": "Procédure de grille",
  "Thursday Press Conference": "Conférence de presse du jeudi",
};

/** A session label from an FIA document in the reader's language ("Free Practice 3"). */
export function fiaSessionLabel(label: string | null | undefined, locale: Locale): string {
  if (!label) return "";
  if (locale === "en") return label.replace(/^Practice (\d)$/, "Free Practice $1");
  return FIA_SESSIONS_FR[label] ?? label;
}
