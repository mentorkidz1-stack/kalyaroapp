// Notation d'une épreuve sur barème — fonctions pures, sans accès base ni IA.

/** Les points d'une question s'attribuent par quarts de point, comme sur une copie. */
export const PAS_POINTS = 0.25;
/** En dessous de la moitié des points, la question est « ratée » (diagnostic de prérequis). */
export const SEUIL_QUESTION_RATEE = 0.5;

/** Borne et arrondit au quart de point la note proposée par l'IA : jamais négative, jamais
 * au-dessus du maximum de la question, jamais NaN. */
export function arrondirPoints(valeur: number, max: number): number {
  if (!Number.isFinite(valeur) || max <= 0) return 0;
  const borne = Math.min(Math.max(valeur, 0), max);
  return Math.round(borne / PAS_POINTS) * PAS_POINTS;
}

export function estRatee(pointsObtenus: number, pointsMax: number): boolean {
  return pointsMax > 0 && pointsObtenus < pointsMax * SEUIL_QUESTION_RATEE;
}

export interface QuestionBareme {
  cle: string;
  numero: string;
  points: number;
  notionId: string | null;
  notionNom: string | null;
}

export interface ReponseNotee {
  cle: string;
  pointsObtenus: number;
}

export interface RapportEpreuve {
  /** Points obtenus ramenés au barème de l'épreuve. */
  note: number;
  bareme: number;
  noteSur20: number;
  nbQuestions: number;
  nbRepondues: number;
  parQuestion: {
    cle: string;
    numero: string;
    points: number;
    pointsObtenus: number;
    repondue: boolean;
    ratee: boolean;
  }[];
  /** Trié par points perdus décroissants : les notions qui coûtent le plus d'abord. */
  parNotion: {
    notionId: string | null;
    notionNom: string;
    points: number;
    pointsObtenus: number;
    pointsPerdus: number;
  }[];
}

const arrondi2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Note finale et détail par question et par notion. Une question sans réponse vaut 0. Si le
 * barème de l'épreuve diffère de la somme des points des questions (sujet mal découpé, points
 * bonus…), la note est ramenée proportionnellement au barème annoncé.
 */
export function calculerRapport(
  questions: QuestionBareme[],
  reponses: ReponseNotee[],
  baremeEpreuve: number | null
): RapportEpreuve {
  const parCle = new Map(reponses.map((r) => [r.cle, r]));
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const bareme = baremeEpreuve && baremeEpreuve > 0 ? baremeEpreuve : totalPoints;

  const parQuestion = questions.map((q) => {
    const r = parCle.get(q.cle);
    const pointsObtenus = r ? arrondirPoints(r.pointsObtenus, q.points) : 0;
    return {
      cle: q.cle,
      numero: q.numero,
      points: q.points,
      pointsObtenus,
      repondue: !!r,
      ratee: estRatee(pointsObtenus, q.points),
    };
  });

  const obtenus = parQuestion.reduce((s, q) => s + q.pointsObtenus, 0);
  const note = totalPoints > 0 ? arrondi2((obtenus * bareme) / totalPoints) : 0;

  const notions = new Map<string, RapportEpreuve["parNotion"][number]>();
  questions.forEach((q, i) => {
    const cle = q.notionId ?? "__sans_notion__";
    const courant = notions.get(cle) ?? {
      notionId: q.notionId,
      notionNom: q.notionNom ?? "Non rattachée à une notion",
      points: 0,
      pointsObtenus: 0,
      pointsPerdus: 0,
    };
    courant.points += q.points;
    courant.pointsObtenus += parQuestion[i]!.pointsObtenus;
    courant.pointsPerdus = arrondi2(courant.points - courant.pointsObtenus);
    notions.set(cle, courant);
  });

  return {
    note,
    bareme,
    noteSur20: bareme > 0 ? arrondi2((note / bareme) * 20) : 0,
    nbQuestions: questions.length,
    nbRepondues: parQuestion.filter((q) => q.repondue).length,
    parQuestion,
    parNotion: [...notions.values()].sort((a, b) => b.pointsPerdus - a.pointsPerdus),
  };
}
