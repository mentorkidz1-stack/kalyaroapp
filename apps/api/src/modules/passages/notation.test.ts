import { describe, expect, it } from "vitest";
import { arrondirPoints, calculerRapport, estRatee, type QuestionBareme } from "./notation.js";

// Partiel L1 de 4 questions noté sur 20 (critère d'acceptation du chantier 2.1).
const partiel: QuestionBareme[] = [
  { cle: "q1", numero: "1", points: 4, notionId: "n-fonctions", notionNom: "Fonctions usuelles" },
  { cle: "q2", numero: "2.a", points: 6, notionId: "n-derivees", notionNom: "Calcul de dérivées" },
  { cle: "q3", numero: "2.b", points: 4, notionId: "n-derivees", notionNom: "Calcul de dérivées" },
  { cle: "q4", numero: "3", points: 6, notionId: "n-optim", notionNom: "Optimisation économique" },
];

describe("arrondirPoints", () => {
  it("arrondit au quart de point", () => {
    expect(arrondirPoints(2.6, 4)).toBe(2.5);
    expect(arrondirPoints(2.9, 4)).toBe(3);
    expect(arrondirPoints(1.13, 4)).toBe(1.25);
  });
  it("borne entre 0 et le maximum de la question, et neutralise une sortie IA aberrante", () => {
    expect(arrondirPoints(7, 4)).toBe(4);
    expect(arrondirPoints(-1, 4)).toBe(0);
    expect(arrondirPoints(Number.NaN, 4)).toBe(0);
    expect(arrondirPoints(3, 0)).toBe(0);
  });
});

describe("estRatee", () => {
  it("une question est ratée sous la moitié des points", () => {
    expect(estRatee(1.75, 4)).toBe(true);
    expect(estRatee(2, 4)).toBe(false);
    expect(estRatee(0, 0)).toBe(false);
  });
});

describe("calculerRapport", () => {
  it("épreuve de 4 questions notée sur 20 : note sur 20, détail par question et par notion", () => {
    const r = calculerRapport(
      partiel,
      [
        { cle: "q1", pointsObtenus: 4 },
        { cle: "q2", pointsObtenus: 3.5 },
        { cle: "q3", pointsObtenus: 1 },
        { cle: "q4", pointsObtenus: 2.25 },
      ],
      20
    );
    expect(r.note).toBe(10.75);
    expect(r.bareme).toBe(20);
    expect(r.noteSur20).toBe(10.75);
    expect(r.parQuestion.map((q) => [q.numero, q.pointsObtenus, q.ratee])).toEqual([
      ["1", 4, false],
      ["2.a", 3.5, false],
      ["2.b", 1, true],
      ["3", 2.25, true],
    ]);
    // Dérivées : 10 points possibles, 4,5 obtenus → 5,5 perdus ; Optimisation : 3,75 perdus.
    expect(r.parNotion).toEqual([
      { notionId: "n-derivees", notionNom: "Calcul de dérivées", points: 10, pointsObtenus: 4.5, pointsPerdus: 5.5 },
      { notionId: "n-optim", notionNom: "Optimisation économique", points: 6, pointsObtenus: 2.25, pointsPerdus: 3.75 },
      { notionId: "n-fonctions", notionNom: "Fonctions usuelles", points: 4, pointsObtenus: 4, pointsPerdus: 0 },
    ]);
  });

  it("une question sans réponse compte 0", () => {
    const r = calculerRapport(partiel, [{ cle: "q1", pointsObtenus: 4 }], 20);
    expect(r.note).toBe(4);
    expect(r.nbRepondues).toBe(1);
    expect(r.parQuestion.filter((q) => !q.repondue)).toHaveLength(3);
  });

  it("ramène la note au barème annoncé si les points des questions n'y correspondent pas", () => {
    const sur40 = calculerRapport(
      [
        { cle: "a", numero: "1", points: 30, notionId: null, notionNom: null },
        { cle: "b", numero: "2", points: 10, notionId: null, notionNom: null },
      ],
      [
        { cle: "a", pointsObtenus: 15 },
        { cle: "b", pointsObtenus: 5 },
      ],
      20
    );
    expect(sur40.note).toBe(10);
    expect(sur40.noteSur20).toBe(10);
    expect(sur40.parNotion[0]!.notionNom).toBe("Non rattachée à une notion");
  });

  it("sans barème d'épreuve, utilise la somme des points ; une épreuve sur 40 est aussi ramenée sur 20", () => {
    const r = calculerRapport(
      [{ cle: "unique", numero: "1", points: 40, notionId: "n", notionNom: "N" }],
      [{ cle: "unique", pointsObtenus: 30 }],
      null
    );
    expect(r.bareme).toBe(40);
    expect(r.note).toBe(30);
    expect(r.noteSur20).toBe(15);
  });

  it("borne une note IA au-dessus du maximum de la question", () => {
    const r = calculerRapport(partiel, [{ cle: "q1", pointsObtenus: 9 }], 20);
    expect(r.parQuestion[0]!.pointsObtenus).toBe(4);
  });
});
