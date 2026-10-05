import { describe, expect, it } from "vitest";
import { choisirQuestionSuivante, type QuestionCandidate } from "./selection-qcm.js";

const q = (id: string, statut = "PUBLIE", varianteDeId: string | null = null): QuestionCandidate => ({
  id,
  statut,
  varianteDeId,
});

const echecSur = (questionQcmId: string, questionRacineId = questionQcmId) => ({
  questionQcmId,
  correcte: false,
  questionRacineId,
});
const reussiteSur = (questionQcmId: string, questionRacineId = questionQcmId) => ({
  questionQcmId,
  correcte: true,
  questionRacineId,
});

// Parcourt toutes les sorties possibles du tirage aléatoire.
function toutesLesSelections(questions: QuestionCandidate[], derniere: Parameters<typeof choisirQuestionSuivante>[1]) {
  const ids = new Set<string>();
  const motifs = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const r = choisirQuestionSuivante(questions, derniere, () => i / 100);
    if (r) {
      ids.add(r.question.id);
      motifs.add(r.motif);
    }
  }
  return { ids, motifs };
}

describe("choisirQuestionSuivante", () => {
  it("ne renvoie rien si aucune question n'est publiée", () => {
    expect(choisirQuestionSuivante([q("a", "A_VALIDER"), q("b", "BROUILLON")], null)).toBeNull();
  });

  it("après un échec, sert une variante publiée de la question ratée", () => {
    const questions = [q("a"), q("a-v1", "PUBLIE", "a"), q("a-v2", "PUBLIE", "a"), q("b")];
    const { ids, motifs } = toutesLesSelections(questions, echecSur("a"));
    expect(ids).toEqual(new Set(["a-v1", "a-v2"]));
    expect(motifs).toEqual(new Set(["variante"]));
  });

  it("ne sert jamais une variante en attente de validation", () => {
    const questions = [q("a"), q("a-v1", "A_VALIDER", "a"), q("a-v2", "BROUILLON", "a"), q("b")];
    const { ids, motifs } = toutesLesSelections(questions, echecSur("a"));
    expect(ids).toEqual(new Set(["b"]));
    expect(motifs).toEqual(new Set(["autre_question"]));
  });

  it("après l'échec d'une variante, peut resservir l'origine ou une autre variante de la même famille", () => {
    const questions = [q("a"), q("a-v1", "PUBLIE", "a"), q("a-v2", "PUBLIE", "a"), q("b")];
    const { ids } = toutesLesSelections(questions, echecSur("a-v1", "a"));
    expect(ids).toEqual(new Set(["a", "a-v2"]));
  });

  it("à défaut de variante, sert une autre question publiée de la notion", () => {
    const { ids, motifs } = toutesLesSelections([q("a"), q("b"), q("c")], echecSur("a"));
    expect(ids).toEqual(new Set(["b", "c"]));
    expect(motifs).toEqual(new Set(["autre_question"]));
  });

  it("en dernier recours, renvoie la même question plutôt qu'un contenu non validé", () => {
    const r = choisirQuestionSuivante([q("a"), q("a-v1", "A_VALIDER", "a")], echecSur("a"));
    expect(r).toEqual({ question: q("a"), motif: "meme_question" });
  });

  it("après une réussite, évite la famille de la question réussie quand c'est possible", () => {
    const questions = [q("a"), q("a-v1", "PUBLIE", "a"), q("b"), q("c")];
    const { ids, motifs } = toutesLesSelections(questions, reussiteSur("a"));
    expect(ids).toEqual(new Set(["b", "c"]));
    expect(motifs).toEqual(new Set(["nouvelle"]));
  });

  it("après une réussite, sert une variante si la notion n'a qu'une famille de questions", () => {
    const { ids } = toutesLesSelections([q("a"), q("a-v1", "PUBLIE", "a")], reussiteSur("a"));
    expect(ids).toEqual(new Set(["a-v1"]));
  });

  it("première question de la notion : n'importe quelle question publiée", () => {
    const { ids, motifs } = toutesLesSelections([q("a"), q("b", "A_VALIDER")], null);
    expect(ids).toEqual(new Set(["a"]));
    expect(motifs).toEqual(new Set(["nouvelle"]));
  });
});

describe("erreurs à rattraper (cahier d'erreurs)", () => {
  const q = (id: string, varianteDeId: string | null = null): QuestionCandidate => ({ id, statut: "PUBLIE", varianteDeId });
  const questions = [q("a"), q("a-v1", "a"), q("b"), q("c")];

  it("fait revenir une erreur passée sous forme de variante", () => {
    const r = choisirQuestionSuivante(questions, { questionQcmId: "c", correcte: true, questionRacineId: "c" }, () => 0, [
      { questionQcmId: "a", questionRacineId: "a" },
    ]);
    expect(r).toEqual({ question: questions[1], motif: "erreur_a_rattraper" });
  });

  it("ressert la question ratée si la famille n'a pas de variante", () => {
    const r = choisirQuestionSuivante(questions, { questionQcmId: "c", correcte: true, questionRacineId: "c" }, () => 0, [
      { questionQcmId: "b", questionRacineId: "b" },
    ]);
    expect(r?.question.id).toBe("b");
  });

  it("l'échec qui vient d'avoir lieu reste prioritaire", () => {
    const r = choisirQuestionSuivante(questions, { questionQcmId: "a", correcte: false, questionRacineId: "a" }, () => 0, [
      { questionQcmId: "b", questionRacineId: "b" },
    ]);
    expect(r).toEqual({ question: questions[1], motif: "variante" });
  });
});
