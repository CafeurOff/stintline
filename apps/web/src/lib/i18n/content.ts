import type { Locale } from "./locale";

/** French names of the Grands Prix, keyed by the API (Jolpica) English name. */
const EVENT_NAMES_FR: Record<string, string> = {
  "Australian Grand Prix": "Grand Prix d'Australie",
  "Chinese Grand Prix": "Grand Prix de Chine",
  "Japanese Grand Prix": "Grand Prix du Japon",
  "Bahrain Grand Prix": "Grand Prix de Bahreïn",
  "Saudi Arabian Grand Prix": "Grand Prix d'Arabie saoudite",
  "Miami Grand Prix": "Grand Prix de Miami",
  "Emilia Romagna Grand Prix": "Grand Prix d'Émilie-Romagne",
  "Monaco Grand Prix": "Grand Prix de Monaco",
  "Spanish Grand Prix": "Grand Prix d'Espagne",
  "Canadian Grand Prix": "Grand Prix du Canada",
  "Austrian Grand Prix": "Grand Prix d'Autriche",
  "British Grand Prix": "Grand Prix de Grande-Bretagne",
  "Belgian Grand Prix": "Grand Prix de Belgique",
  "Hungarian Grand Prix": "Grand Prix de Hongrie",
  "Dutch Grand Prix": "Grand Prix des Pays-Bas",
  "Italian Grand Prix": "Grand Prix d'Italie",
  "Azerbaijan Grand Prix": "Grand Prix d'Azerbaïdjan",
  "Singapore Grand Prix": "Grand Prix de Singapour",
  "United States Grand Prix": "Grand Prix des États-Unis",
  "Mexico City Grand Prix": "Grand Prix de Mexico",
  "São Paulo Grand Prix": "Grand Prix de São Paulo",
  "Las Vegas Grand Prix": "Grand Prix de Las Vegas",
  "Qatar Grand Prix": "Grand Prix du Qatar",
  "Abu Dhabi Grand Prix": "Grand Prix d'Abou Dhabi",
  // Past Grands Prix (1950 onwards).
  "Argentine Grand Prix": "Grand Prix d'Argentine",
  "Brazilian Grand Prix": "Grand Prix du Brésil",
  "Caesars Palace Grand Prix": "Grand Prix de Caesars Palace",
  "Dallas Grand Prix": "Grand Prix de Dallas",
  "Detroit Grand Prix": "Grand Prix de Détroit",
  "Eifel Grand Prix": "Grand Prix de l'Eifel",
  "European Grand Prix": "Grand Prix d'Europe",
  "French Grand Prix": "Grand Prix de France",
  "German Grand Prix": "Grand Prix d'Allemagne",
  "Indian Grand Prix": "Grand Prix d'Inde",
  "Indianapolis 500": "500 miles d'Indianapolis",
  "Korean Grand Prix": "Grand Prix de Corée",
  "Luxembourg Grand Prix": "Grand Prix du Luxembourg",
  "Malaysian Grand Prix": "Grand Prix de Malaisie",
  "Mexican Grand Prix": "Grand Prix du Mexique",
  "Moroccan Grand Prix": "Grand Prix du Maroc",
  "Pacific Grand Prix": "Grand Prix du Pacifique",
  "Pescara Grand Prix": "Grand Prix de Pescara",
  "Portuguese Grand Prix": "Grand Prix du Portugal",
  "Russian Grand Prix": "Grand Prix de Russie",
  "Sakhir Grand Prix": "Grand Prix de Sakhir",
  "San Marino Grand Prix": "Grand Prix de Saint-Marin",
  "South African Grand Prix": "Grand Prix d'Afrique du Sud",
  "Styrian Grand Prix": "Grand Prix de Styrie",
  "Swedish Grand Prix": "Grand Prix de Suède",
  "Swiss Grand Prix": "Grand Prix de Suisse",
  "Turkish Grand Prix": "Grand Prix de Turquie",
  "Tuscan Grand Prix": "Grand Prix de Toscane",
  "United States Grand Prix West": "Grand Prix des États-Unis Ouest",
  "70th Anniversary Grand Prix": "Grand Prix du 70e anniversaire",
  // New names from 2026.
  "Barcelona Grand Prix": "Grand Prix de Barcelone",
  "Madrid Grand Prix": "Grand Prix de Madrid",
  "Bahrain Grand Prix in Malaysia": "Grand Prix de Bahreïn en Malaisie",
};

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
