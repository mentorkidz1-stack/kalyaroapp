import { describe, expect, it } from "vitest";
import { construireCahierErreurs, type ErreurEleve } from "./cahier-erreurs.js";

let n = 0;
const erreur = (partiel: Partial<ErreurEleve>): ErreurEleve => ({
  id: `e${++n}`,
  createdAt: new Date(Date.UTC(2026, 9, 1, 8, n)),
  notionId: "moyenne",
  notionNom: "Moyenne",
  chapitreId: "stats",
  typeErreur: "CALCUL",
  explication: null,
  enonce: "Calcule la moyenne.",
  source: "QCM",
  corrigee: false,
  ...partiel,
});

describe("construireCahierErreurs", () => {
  it("dégage les 3 erreurs signature parmi ce qui reste à travailler", () => {
    const c = construireCahierErreurs([
      erreur({ typeErreur: "CALCUL" }),
      erreur({ typeErreur: "CALCUL" }),
      erreur({ typeErreur: "CALCUL", corrigee: true }), // rattrapée : ne compte pas
      erreur({ notionId: "mediane", notionNom: "Médiane", typeErreur: "CONFUSION" }),
      erreur({ notionId: "mediane", notionNom: "Médiane", typeErreur: "CONFUSION" }),
      erreur({ notionId: "mediane", notionNom: "Médiane", typeErreur: "CONFUSION" }),
      erreur({ notionId: "variance", notionNom: "Variance", typeErreur: "PROCEDURE" }),
      erreur({ notionId: "variance", notionNom: "Variance", typeErreur: "LECTURE_ENONCE" }),
      erreur({ typeErreur: null }), // pas encore classée
    ]);
    expect(c.signatures.map((s) => [s.notionNom, s.typeErreur, s.nombre])).toEqual([
      ["Médiane", "CONFUSION", 3],
      ["Moyenne", "CALCUL", 2],
      ["Variance", "LECTURE_ENONCE", 1], // à égalité, la plus récente
    ]);
    expect(c.aTravailler).toBe(8);
    expect(c.enVoieDeCorrection).toBe(1);
    expect(c.nonClassees).toBe(1);
  });

  it("compte par type et par notion, la plus chargée d'abord", () => {
    const c = construireCahierErreurs([
      erreur({ typeErreur: "CALCUL" }),
      erreur({ typeErreur: "CALCUL", corrigee: true }),
      erreur({ notionId: "mediane", notionNom: "Médiane", typeErreur: "CONFUSION" }),
      erreur({ notionId: "mediane", notionNom: "Médiane", typeErreur: "CONFUSION" }),
    ]);
    expect(c.parType).toEqual([
      { typeErreur: "CONFUSION", aTravailler: 2, enVoieDeCorrection: 0 },
      { typeErreur: "CALCUL", aTravailler: 1, enVoieDeCorrection: 1 },
    ]);
    expect(c.notions.map((x) => x.notionId)).toEqual(["mediane", "moyenne"]);
    const moyenne = c.notions[1]!;
    expect(moyenne).toMatchObject({ aTravailler: 1, enVoieDeCorrection: 1, parType: { CALCUL: 2 } });
    expect(moyenne.erreurs[0]!.statut).toBe("EN_VOIE_DE_CORRECTION"); // la plus récente d'abord
  });

  it("reste vide sans erreur", () => {
    expect(construireCahierErreurs([])).toMatchObject({ aTravailler: 0, signatures: [], notions: [] });
  });
});
