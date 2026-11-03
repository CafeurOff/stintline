import type { MessageKey } from "./en";

/** French copy. Typed against the English keys: a missing translation fails the build. */
export const fr: Record<MessageKey, string> = {
  "app.skip": "Aller au contenu",
  "app.disclaimer":
    "Projet non officiel, sans lien avec la Formule 1, la FIA ou une écurie. Données : OpenF1, Jolpica.",
  "nav.label": "Navigation principale",
  "nav.race": "Course",
  "nav.tyres": "Pneus",
  "nav.model": "Comment ça marche",
  "header.race": "Course",
  "header.language": "Langue",
  "theme.toLight": "Passer au thème clair",
  "theme.toDark": "Passer au thème sombre",

  "api.checking": "Vérification du serveur…",
  "api.online": "Serveur en ligne · v{version}",
  "api.degraded": "Serveur dégradé (base de données {database})",
  "api.unreachable": "Serveur injoignable",

  "common.retry": "Réessayer",
  "common.loading": "Chargement…",
  "common.error": "Une erreur est survenue",
  "common.clear": "Effacer",
  "error.network": "Impossible de joindre le serveur.",
  "error.throttled": "Trop de simulations en peu de temps. Réessayez dans un instant.",
  "error.unexpected": "Le serveur a renvoyé une réponse inattendue.",

  "home.empty.title": "Aucune course chargée",
  "home.empty.body": "Chargez les courses de démonstration avec make seed, puis rechargez la page.",
  "notFound.title": "Page introuvable",
  "notFound.back": "Retour aux courses",

  "map.title": "{circuit} : les voitures en piste, tour {lap}",
  "map.noTrack":
    "Pas de tracé du circuit pour cette course. Les simulations restent disponibles dans le panneau.",
  "replay.play": "Lecture",
  "replay.pause": "Pause",
  "replay.lap": "Tour {lap}",
  "replay.slider": "Tour",
  "replay.sliderValue": "Tour {lap} sur {total}",
  "replay.speed": "Vitesse du rejeu",
  "replay.finished": "Drapeau à damier",

  "panel.mode": "Simulation",
  "panel.mode.stop": "Arrêt",
  "panel.mode.undercut": "Undercut",
  "panel.driver": "Pilote",

  "stop.question": "Et si {name} s'arrêtait maintenant ?",
  "stop.running": "{position} · pneus {compound}, {age} tours",
  "stop.go": "Simuler l'arrêt",
  "stop.rejoin": "à la sortie des stands",
  "stop.between":
    "{code} perdrait environ {loss} et ressortirait entre {ahead} ({aheadGap} devant) et {behind} ({behindGap} derrière).",
  "stop.front":
    "{code} perdrait environ {loss} et resterait devant {behind} ({behindGap} derrière).",
  "stop.back":
    "{code} perdrait environ {loss} et ressortirait derrière {ahead} ({aheadGap} devant).",
  "stop.close":
    "Serré avec {names} : un arrêt plus rapide ou plus lent de {sigma} change le résultat. La zone claire sur le circuit montre cette marge.",
  "stop.safe": "Personne à moins de {sigma} : le résultat est fiable.",
  "stop.cannot":
    "{name} ne peut pas s'arrêter à ce tour. Placez le rejeu entre le tour 2 et le tour {max}.",

  "undercut.question": "{attacker} peut-il passer {defender} grâce à l'undercut ?",
  "undercut.leader": "{name} est en tête : il n'y a personne devant à dépasser.",
  "undercut.defender": "Voiture devant",
  "undercut.tyres": "Nouveaux pneus de {code}",
  "undercut.reaction": "Réaction de {code}",
  "undercut.reaction.value": "{n} tour plus tard",
  "undercut.reaction.values": "{n} tours plus tard",
  "undercut.go": "Simuler l'undercut",
  "undercut.works": "{attacker} ressortirait devant",
  "undercut.fails": "{attacker} resterait derrière",
  "undercut.detail":
    "Une fois les deux voitures arrêtées, {attacker} serait {gap} {side} {defender} (l'écart est de {before} maintenant). Chance de ressortir devant : {p}.",
  "undercut.side.ahead": "devant",
  "undercut.side.behind": "derrière",

  "tyres.title": "Pneus",
  "tyres.wear": "perdent {ms} par tour",
  "tyres.fresh": "neufs : {time}",
  "tyres.rough": "peu de tours, estimation grossière",
  "tyres.strategies": "Qui a roulé avec quoi",
  "tyres.used": "* relais commencé avec des pneus usés",
  "tyres.chart": "Le temps au tour à mesure que les pneus s'usent",
  "tyres.chartNote":
    "Chaque point est un tour, corrigé du carburant brûlé. Plus la ligne monte vite, plus les pneus s'usent vite.",
  "tyres.chartLabel":
    "Temps au tour corrigé du carburant selon l'âge des pneus pour {drivers}, avec la tendance de chaque relais.",
  "tyres.drivers": "Pilotes",
  "tyres.age": "Âge des pneus (tours)",
  "tyres.noFit": "Pas assez de tours propres pour mesurer l'usure des pneus sur cette course.",
  "tyres.table": "Afficher en tableau",
  "tyres.col.driver": "Pilote",
  "tyres.col.stint": "Relais",
  "tyres.col.compound": "Pneus",
  "tyres.col.laps": "Tours",
  "tyres.col.wear": "Usure",

  "model.title": "Comment fonctionne StintLine",
  "model.intro":
    "StintLine lit le vrai chrono de chaque tour. Il écarte les tours qui ne disent rien du rythme (départ, passages aux stands, safety car, trafic), corrige l'effet du carburant brûlé, mesure la vitesse d'usure de chaque pneu et le temps que coûte un arrêt sur chaque circuit. Il en déduit où un pilote ressort après son arrêt, avec une marge d'erreur.",
  "model.test.title": "Testé sur des courses qu'il n'avait jamais vues",
  "model.test.body":
    "{n} vrais arrêts tirés de six courses 2025 jamais utilisées pour régler le modèle : la position prédite était exacte {exact} du temps, et à une place près {within} du temps.",
  "model.test.compare":
    "En moyenne, la prédiction se trompe de {mae} place. Se contenter de garder la position actuelle se tromperait de {baseline} places.",
  "model.test.missing": "Les résultats des tests ne sont pas disponibles.",
  "model.details": "Réglages et hypothèses",
  "model.details.note": "Chaque hypothèse est un réglage nommé, avec une valeur justifiée.",

  "compound.SOFT": "Tendre",
  "compound.MEDIUM": "Médium",
  "compound.HARD": "Dur",
  "compound.INTERMEDIATE": "Intermédiaire",
  "compound.WET": "Pluie",
  "compound.UNKNOWN": "Inconnu",
  "compoundPlural.SOFT": "Tendres",
  "compoundPlural.MEDIUM": "Médiums",
  "compoundPlural.HARD": "Durs",
  "compoundPlural.INTERMEDIATE": "Intermédiaires",
  "compoundPlural.WET": "Pluie",
  "compoundPlural.UNKNOWN": "Pneus inconnus",
  "compoundLower.SOFT": "tendres",
  "compoundLower.MEDIUM": "médium",
  "compoundLower.HARD": "durs",
  "compoundLower.INTERMEDIATE": "intermédiaires",
  "compoundLower.WET": "pluie",
  "compoundLower.UNKNOWN": "inconnus",
};
