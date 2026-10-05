export type TypeErreur = "CONNAISSANCE" | "CONFUSION" | "PROCEDURE" | "LECTURE_ENONCE" | "CALCUL" | "METHODE" | "REDACTION";

/** Ce que l'élève peut faire, selon le remède. */
export type ActionRemede = "FICHE" | "SERIE_QCM" | "DECORTIQUER" | "EPREUVES";

export interface Remede {
  libelle: string;
  icone: string;
  /** Titre du remède, à l'impératif. */
  titre: string;
  conseil: string;
  actions: ActionRemede[];
}

/** Remède adapté à chaque cause d'erreur (chantier 3.2). Textes fixes, relus : aucun contenu IA. */
export const REMEDES: Record<TypeErreur, Remede> = {
  CONNAISSANCE: {
    libelle: "Connaissance",
    icone: "📖",
    titre: "Revois la notion",
    conseil: "Il te manquait une définition, une formule ou une propriété. Relis la fiche, puis vérifie en quelques questions que c'est revenu.",
    actions: ["FICHE", "SERIE_QCM"],
  },
  CONFUSION: {
    libelle: "Confusion",
    icone: "🔀",
    titre: "Sépare les deux notions",
    conseil: "Tu as mélangé deux notions voisines. Sur une feuille, écris-les côte à côte avec un exemple chacune : ce qui les distingue doit sauter aux yeux.",
    actions: ["FICHE", "SERIE_QCM"],
  },
  PROCEDURE: {
    libelle: "Procédure",
    icone: "🪜",
    titre: "Reprends la méthode étape par étape",
    conseil: "Tu connais la notion, mais une étape a sauté ou a été faite dans le désordre. Écris la liste des étapes, puis refais un exercice en les cochant une à une.",
    actions: ["FICHE", "SERIE_QCM"],
  },
  LECTURE_ENONCE: {
    libelle: "Lecture de l'énoncé",
    icone: "🔍",
    titre: "Décortique la consigne",
    conseil: "Ta réponse ne répondait pas tout à fait à la question posée. Avant de calculer, prends dix secondes pour décortiquer l'énoncé.",
    actions: ["DECORTIQUER", "SERIE_QCM"],
  },
  CALCUL: {
    libelle: "Calcul",
    icone: "🧮",
    titre: "Une série courte d'automatismes",
    conseil: "Ton raisonnement tenait, c'est un calcul ou un signe qui a lâché. Enchaîne quelques questions rapides, et prends l'habitude d'estimer l'ordre de grandeur du résultat.",
    actions: ["SERIE_QCM"],
  },
  METHODE: {
    libelle: "Choix de méthode",
    icone: "🧭",
    titre: "Choisis l'outil avant de calculer",
    conseil: "Tu es parti sur une approche qui ne convenait pas. Avant de te lancer, demande-toi : quel type de question est-ce, et quel outil du cours lui correspond ?",
    actions: ["FICHE", "SERIE_QCM"],
  },
  REDACTION: {
    libelle: "Rédaction",
    icone: "✍️",
    titre: "Soigne la justification",
    conseil: "Le fond était là, la rédaction non. À l'examen : écris la formule utilisée, remplace par les valeurs, puis conclus par une phrase qui répond à la question.",
    actions: ["EPREUVES"],
  },
};

export const ORDRE_TYPES = Object.keys(REMEDES) as TypeErreur[];
