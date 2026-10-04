import { describe, expect, it } from "vitest";
import {
  aimanter,
  corrigerReponseFigure,
  decoderPoint,
  encoderPoint,
  libelleReponseAttendue,
  lireNombre,
  reponseAttendueSchema,
  verifierQuestionSurFigure,
} from "./reponses.js";

describe("lireNombre", () => {
  it("lit les écritures d'étudiant", () => {
    expect(lireNombre("2,5")).toBe(2.5);
    expect(lireNombre(" −3 ")).toBe(-3);
    expect(lireNombre("+4")).toBe(4);
    expect(lireNombre("1/2")).toBe(0.5);
    expect(lireNombre("-3/4")).toBe(-0.75);
    expect(lireNombre("3 cm")).toBe(3);
    expect(lireNombre(".5")).toBe(0.5);
  });
  it("refuse ce qui n'est pas un nombre", () => {
    for (const s of ["", "deux", "2,5,3", "1/0", "x=2", "2..5"]) expect(lireNombre(s), s).toBeNull();
  });
});

describe("placer un point", () => {
  const attendu = reponseAttendueSchema.parse({ type: "PLACER_POINT", x: 2, y: 3, tolerance: 0.25 });

  it("accepte dans la tolérance, sur chaque coordonnée", () => {
    expect(corrigerReponseFigure(attendu, encoderPoint(2, 3))).toBe(true);
    expect(corrigerReponseFigure(attendu, encoderPoint(2.25, 2.75))).toBe(true);
    expect(corrigerReponseFigure(attendu, encoderPoint(2.3, 3))).toBe(false);
    expect(corrigerReponseFigure(attendu, encoderPoint(2, 3.5))).toBe(false);
  });

  it("refuse une réponse mal formée", () => {
    expect(corrigerReponseFigure(attendu, "2,3")).toBe(false);
    expect(corrigerReponseFigure(attendu, "")).toBe(false);
    expect(decoderPoint("1.5;-2")).toEqual([1.5, -2]);
  });

  it("aimante le point à la grille", () => {
    expect(aimanter(1.87, 0.5)).toBe(2);
    expect(aimanter(-0.26, 0.5)).toBe(-0.5);
    expect(aimanter(1.87, undefined)).toBe(1.87);
    expect(aimanter(0.1 + 0.2, 0.1)).toBe(0.3);
  });
});

describe("lire une valeur", () => {
  const attendu = reponseAttendueSchema.parse({ type: "LIRE_VALEUR", valeur: 2.5, tolerance: 0.2, unite: "k F" });

  it("accepte la lecture graphique approximative", () => {
    expect(corrigerReponseFigure(attendu, "2,5")).toBe(true);
    expect(corrigerReponseFigure(attendu, "2,7")).toBe(true);
    expect(corrigerReponseFigure(attendu, "2.3")).toBe(true);
    expect(corrigerReponseFigure(attendu, "2,8")).toBe(false);
    expect(corrigerReponseFigure(attendu, "5/2")).toBe(true);
    expect(corrigerReponseFigure(attendu, "deux et demi")).toBe(false);
  });

  it("affiche la bonne réponse en français", () => {
    expect(libelleReponseAttendue(attendu)).toBe("2,5 k F");
    expect(libelleReponseAttendue({ type: "PLACER_POINT", x: -1.5, y: 2, tolerance: 0.1 })).toBe("(−1,5 ; 2)");
  });
});

describe("verifierQuestionSurFigure", () => {
  const repere = { type: "repere", xMin: -2, xMax: 5, yMin: -1, yMax: 6, elements: [] };
  it("accepte une question cohérente", () => {
    expect(verifierQuestionSurFigure("PLACER_POINT", repere, { type: "PLACER_POINT", x: 2, y: 3, tolerance: 0.25 })).toEqual([]);
    expect(verifierQuestionSurFigure("LIRE_VALEUR", repere, { type: "LIRE_VALEUR", valeur: 4, tolerance: 0.2 })).toEqual([]);
    expect(verifierQuestionSurFigure("CHOIX", null, null)).toEqual([]);
  });
  it("refuse les incohérences", () => {
    expect(verifierQuestionSurFigure("PLACER_POINT", repere, { type: "PLACER_POINT", x: 9, y: 3, tolerance: 0.25 })).toEqual([
      "Le point attendu est hors de la fenêtre du repère",
    ]);
    expect(verifierQuestionSurFigure("PLACER_POINT", { type: "arbre_probabilites" }, { type: "PLACER_POINT", x: 1, y: 1, tolerance: 1 })).toEqual([
      "Placer un point demande une figure de type repère",
    ]);
    expect(verifierQuestionSurFigure("LIRE_VALEUR", null, { type: "LIRE_VALEUR", valeur: 4, tolerance: 0.2 })[0]).toMatch(/figure est obligatoire/);
    expect(verifierQuestionSurFigure("LIRE_VALEUR", repere, { type: "PLACER_POINT", x: 1, y: 1, tolerance: 1 })[0]).toMatch(/type LIRE_VALEUR/);
    expect(verifierQuestionSurFigure("LIRE_VALEUR", repere, undefined)[0]).toMatch(/Réponse attendue/);
  });
});

describe("reponseAttendueSchema", () => {
  it("refuse une tolérance nulle pour placer un point ou un type inconnu", () => {
    expect(reponseAttendueSchema.safeParse({ type: "PLACER_POINT", x: 1, y: 1, tolerance: 0 }).success).toBe(false);
    expect(reponseAttendueSchema.safeParse({ type: "DESSINER", x: 1 }).success).toBe(false);
  });
});
