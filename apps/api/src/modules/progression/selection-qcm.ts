// Choix de la prochaine question QCM d'une notion — fonction pure, sans accès base.
//
// Règle d'or : seul du contenu PUBLIÉ (validé par un humain) part vers l'étudiant. Il n'y
// a plus aucune génération IA en direct ici ; après un échec on sert une variante validée
// de la question ratée, à défaut une autre question publiée de la notion, et en dernier
// recours la même question (le choix des réponses est remélangé par l'appelant).

export interface QuestionCandidate {
  id: string;
  statut: string;
  varianteDeId: string | null;
}

export interface DerniereTentative {
  questionQcmId: string;
  correcte: boolean | null;
  /** Question d'origine de la question tentée (elle-même si ce n'est pas une variante). */
  questionRacineId: string;
}

export type MotifSelection = "variante" | "autre_question" | "meme_question" | "nouvelle";

export function racineDe(q: Pick<QuestionCandidate, "id" | "varianteDeId">): string {
  return q.varianteDeId ?? q.id;
}

export function choisirQuestionSuivante<T extends QuestionCandidate>(
  questions: T[],
  derniere: DerniereTentative | null,
  random: () => number = Math.random
): { question: T; motif: MotifSelection } | null {
  const pool = questions.filter((q) => q.statut === "PUBLIE");
  if (pool.length === 0) return null;
  const tirer = (liste: T[]) => liste[Math.floor(random() * liste.length)]!;

  const autres = derniere ? pool.filter((q) => q.id !== derniere.questionQcmId) : pool;

  if (derniere?.correcte === false) {
    // Même famille que la question ratée : ses variantes, ou la question d'origine si
    // l'étudiant vient de rater une variante.
    const famille = autres.filter((q) => racineDe(q) === derniere.questionRacineId);
    if (famille.length > 0) return { question: tirer(famille), motif: "variante" };
  }

  if (autres.length > 0) {
    // Après une réussite, on évite de resservir tout de suite la même famille si possible.
    const horsFamille = derniere ? autres.filter((q) => racineDe(q) !== derniere.questionRacineId) : autres;
    const choix = horsFamille.length > 0 ? horsFamille : autres;
    return { question: tirer(choix), motif: derniere?.correcte === false ? "autre_question" : "nouvelle" };
  }

  return { question: tirer(pool), motif: derniere ? "meme_question" : "nouvelle" };
}
