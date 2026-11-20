import type { Locale } from "./locale";

/** One racing or statistics term: its name and a one- or two-sentence definition. */
interface Entry {
  term: string;
  definition: string;
}

/**
 * Words a casual fan may not know, explained once for the whole site (the `Term` popover
 * and the "How it works" page read them from here).
 */
export const GLOSSARY = {
  undercut: {
    en: {
      term: "Undercut",
      definition:
        "Pitting before the car ahead: fresh tyres are faster for a few laps, so the time gained can be enough to come out in front once the other car stops.",
    },
    fr: {
      term: "Undercut",
      definition:
        "S'arrêter avant la voiture de devant : les pneus neufs sont plus rapides pendant quelques tours, et le temps gagné peut suffire pour ressortir devant quand l'autre s'arrête à son tour.",
    },
  },
  overcut: {
    en: {
      term: "Overcut",
      definition:
        "The opposite of the undercut: staying out longer than the car ahead, on a clear track, and gaining enough to come out in front after your own stop.",
    },
    fr: {
      term: "Overcut",
      definition:
        "L'inverse de l'undercut : rester en piste plus longtemps que la voiture de devant, piste dégagée, et gagner assez pour ressortir devant après son propre arrêt.",
    },
  },
  pitLoss: {
    en: {
      term: "Pit loss",
      definition:
        "Time a stop costs compared with staying on track: driving through the pit lane at limited speed plus the stop itself. Around 20 to 25 s at most circuits, much less under a safety car.",
    },
    fr: {
      term: "Perte au stand",
      definition:
        "Le temps que coûte un arrêt par rapport à rester en piste : la traversée de la voie des stands à vitesse limitée plus l'arrêt lui-même. Environ 20 à 25 s sur la plupart des circuits, beaucoup moins sous voiture de sécurité.",
    },
  },
  stationary: {
    en: {
      term: "Stationary time",
      definition:
        "How long the car stands still in its box while the tyres are changed. The best crews do it in about 2 seconds.",
    },
    fr: {
      term: "Immobilisation",
      definition:
        "Le temps où la voiture est arrêtée devant son garage pendant le changement de pneus. Les meilleures équipes le font en 2 secondes environ.",
    },
  },
  fuelCorrected: {
    en: {
      term: "Fuel-corrected",
      definition:
        "Lap times with the weight of the fuel taken out: a car gets a few hundredths of a second faster every lap as it burns fuel, which would otherwise hide how much the tyres wear.",
    },
    fr: {
      term: "Corrigé du carburant",
      definition:
        "Temps au tour dont on retire l'effet du poids de l'essence : la voiture gagne quelques centièmes de seconde par tour en s'allégeant, ce qui cacherait sinon l'usure des pneus.",
    },
  },
  degradation: {
    en: {
      term: "Tyre wear",
      definition:
        "Lap time lost with every extra lap on the same tyres, measured on clean, fuel-corrected laps.",
    },
    fr: {
      term: "Usure des pneus",
      definition:
        "Le temps perdu à chaque tour de plus sur les mêmes pneus, mesuré sur des tours propres et corrigés du carburant.",
    },
  },
  stint: {
    en: {
      term: "Stint",
      definition: "The laps a driver runs on one set of tyres, between two stops.",
    },
    fr: {
      term: "Relais",
      definition: "Les tours qu'un pilote fait sur un même train de pneus, entre deux arrêts.",
    },
  },
  cleanLap: {
    en: {
      term: "Clean lap",
      definition:
        "A lap that shows a driver's real pace: not the first lap, not a lap into or out of the pits, not under a safety car or a red flag.",
    },
    fr: {
      term: "Tour propre",
      definition:
        "Un tour qui montre le vrai rythme du pilote : ni le premier tour, ni un tour d'entrée ou de sortie des stands, ni un tour sous voiture de sécurité ou drapeau rouge.",
    },
  },
  median: {
    en: {
      term: "Median",
      definition:
        "The middle value: half the laps were faster, half slower. Unlike the average, one very slow lap does not move it.",
    },
    fr: {
      term: "Médiane",
      definition:
        "La valeur du milieu : la moitié des tours ont été plus rapides, l'autre moitié plus lents. Contrairement à la moyenne, un tour très lent ne la fait pas bouger.",
    },
  },
  boxPlot: {
    en: {
      term: "Box and whiskers",
      definition:
        "The box holds the middle half of the laps, the line inside is the median, the whiskers reach the fastest and slowest normal laps, and dots are unusual laps.",
    },
    fr: {
      term: "Boîte à moustaches",
      definition:
        "La boîte contient la moitié centrale des tours, le trait dedans est la médiane, les moustaches vont jusqu'aux tours normaux les plus rapides et les plus lents, et les points sont des tours inhabituels.",
    },
  },
  stdDev: {
    en: {
      term: "Standard deviation",
      definition:
        "How far laps usually stray from the driver's own pace. The smaller it is, the more consistent the driver.",
    },
    fr: {
      term: "Écart-type",
      definition:
        "De combien les tours s'écartent d'habitude du rythme du pilote. Plus il est petit, plus le pilote est régulier.",
    },
  },
  cutoff: {
    en: {
      term: "107 % cut-off",
      definition:
        "Laps slower than 107 % of a driver's best are left out of the pace figures: traffic, a mistake or a slow lap behind the safety car.",
    },
    fr: {
      term: "Seuil de 107 %",
      definition:
        "Les tours plus lents que 107 % du meilleur tour du pilote sont écartés des chiffres de rythme : trafic, erreur ou tour lent derrière la voiture de sécurité.",
    },
  },
  safetyCar: {
    en: {
      term: "SC and VSC",
      definition:
        "Safety car: a car leads the field slowly after an incident. Virtual safety car: every driver must slow down to a set time, without a car on track. Both make a pit stop cheaper.",
    },
    fr: {
      term: "SC et VSC",
      definition:
        "Voiture de sécurité : une voiture mène le peloton au ralenti après un incident. Voiture de sécurité virtuelle : chaque pilote doit ralentir à un temps imposé, sans voiture en piste. Les deux rendent un arrêt moins coûteux.",
    },
  },
  miniSectors: {
    en: {
      term: "Mini-sectors",
      definition:
        "Each of the three sectors is split into small parts, each coloured on timing screens: purple for the fastest of all, green for the driver's own best, yellow otherwise.",
    },
    fr: {
      term: "Mini-secteurs",
      definition:
        "Chacun des trois secteurs est découpé en petites portions, colorées sur les écrans de chronométrage : violet pour le plus rapide de tous, vert pour le meilleur du pilote, jaune sinon.",
    },
  },
  fullThrottle: {
    en: {
      term: "Full throttle",
      definition: "Share of the lap with the accelerator pedal fully pressed.",
    },
    fr: {
      term: "Pleine charge",
      definition: "La part du tour passée accélérateur à fond.",
    },
  },
  penaltyPoints: {
    en: {
      term: "Penalty points",
      definition:
        "Points the stewards add to a driver's licence for an offence. They count for twelve months, and 12 points mean a one-race ban.",
    },
    fr: {
      term: "Points de pénalité",
      definition:
        "Des points que les commissaires ajoutent au permis d'un pilote pour une infraction. Ils comptent douze mois, et 12 points valent une course de suspension.",
    },
  },
  powerUnit: {
    en: {
      term: "Power-unit elements",
      definition:
        "The parts of the hybrid engine (engine, turbo, energy store, electronics…). Each driver has a set number per season; one more means a grid penalty.",
    },
    fr: {
      term: "Éléments du moteur",
      definition:
        "Les pièces du moteur hybride (moteur thermique, turbo, batterie, électronique…). Chaque pilote a droit à un nombre fixe par saison ; un de plus coûte une pénalité sur la grille.",
    },
  },
} as const satisfies Record<string, Record<Locale, Entry>>;

export type TermId = keyof typeof GLOSSARY;

export function glossaryEntry(id: TermId, locale: Locale): Entry {
  return GLOSSARY[id][locale];
}
