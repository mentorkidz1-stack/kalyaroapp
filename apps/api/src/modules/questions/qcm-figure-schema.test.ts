import { describe, expect, it } from "vitest";
import { createQcmSchema } from "./questions.schemas.js";

const notionIds = ["ckq1z2x3y0000abcdefghijkl"];
const repere = { type: "repere", xMin: -2, xMax: 5, yMin: -1, yMax: 6, elements: [] };

describe("createQcmSchema — réponses sur figure", () => {
  it("garde le QCM à choix inchangé", () => {
    const r = createQcmSchema.parse({ enonce: "2 + 2 ?", choix: ["3", "4"], bonneReponse: "4", notionIds });
    expect(r.typeReponse).toBe("CHOIX");
    expect(r.reponseAttendue).toBeUndefined();
    expect(createQcmSchema.safeParse({ enonce: "?", choix: ["3"], bonneReponse: "3", notionIds }).success).toBe(false);
  });

  it("placer un point : pas de choix, bonne réponse lisible déduite", () => {
    const r = createQcmSchema.parse({
      enonce: "Place A(2 ; 3)",
      typeReponse: "PLACER_POINT",
      reponseAttendue: { type: "PLACER_POINT", x: 2, y: 3, tolerance: 0.25, pasGrille: 0.5 },
      figure: repere,
      notionIds,
    });
    expect(r.choix).toEqual([]);
    expect(r.bonneReponse).toBe("(2 ; 3)");
  });

  it("refuse une question sur figure incohérente", () => {
    const sansFigure = createQcmSchema.safeParse({
      enonce: "Lis f(2)",
      typeReponse: "LIRE_VALEUR",
      reponseAttendue: { type: "LIRE_VALEUR", valeur: 4, tolerance: 0.2 },
      notionIds,
    });
    expect(sansFigure.success).toBe(false);
    const horsFenetre = createQcmSchema.safeParse({
      enonce: "Place B",
      typeReponse: "PLACER_POINT",
      reponseAttendue: { type: "PLACER_POINT", x: 9, y: 3, tolerance: 0.25 },
      figure: repere,
      notionIds,
    });
    expect(horsFenetre.success).toBe(false);
  });
});
