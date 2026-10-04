import { describe, expect, it } from "vitest";
import { compilerExpression } from "./expression.js";
import { EXEMPLES_FIGURES, EXEMPLE_FIGURE_INVALIDE } from "./exemples.js";
import { validerFigure, valeurProbabilite, figureOptionnelleSchema } from "./schemas.js";

const f = (e: string) => {
  const r = compilerExpression(e);
  if (!r.ok) throw new Error(r.erreur);
  return r.f;
};

describe("compilerExpression", () => {
  it("calcule les expressions usuelles", () => {
    expect(f("x² − 2x − 1")(4)).toBe(7);
    expect(f("-x^2 + 80x - 300")(40)).toBe(1300);
    expect(f("0,5x + 4")(2)).toBe(5);
    expect(f("10 − 0,8x")(5)).toBe(6);
    expect(f("(x+1)(x−2)")(3)).toBe(4);
    expect(f("2sqrt(x)")(9)).toBe(6);
    expect(f("√x + 1")(16)).toBe(5);
    expect(f("√(x+7)")(9)).toBe(4);
    expect(f("|x − 3|")(1)).toBe(2);
    expect(f("e^x")(0)).toBe(1);
    expect(f("ln(x)")(Math.E)).toBeCloseTo(1);
    expect(f("3·x ÷ 2")(4)).toBe(6);
    expect(f("x^-1")(4)).toBe(0.25);
    expect(f("2πx")(1)).toBeCloseTo(2 * Math.PI);
  });

  it("respecte les priorités : −x² = −(x²), 2^3^2 = 2^9", () => {
    expect(f("-x²")(3)).toBe(-9);
    expect(f("2^3^2")(0)).toBe(512);
  });

  it("refuse le code et les écritures mal formées, avec un message", () => {
    for (const e of ["alert(1)", "process.exit()", "x +", "(x + 1", "2 ** x ;", "", "y + 1"]) {
      const r = compilerExpression(e);
      expect(r.ok, e).toBe(false);
    }
    expect(compilerExpression("foo(x)")).toEqual({ ok: false, erreur: "Nom inconnu « foo »" });
  });

  it("renvoie NaN hors du domaine plutôt que de planter", () => {
    expect(f("sqrt(x)")(-1)).toBeNaN();
    expect(f("1/x")(0)).toBe(Infinity);
  });
});

describe("validerFigure", () => {
  it("accepte chacune des figures de référence", () => {
    for (const ex of EXEMPLES_FIGURES) {
      const r = validerFigure(ex.figure);
      expect(r.ok ? "ok" : r.erreurs.join(" ; "), ex.titre).toBe("ok");
    }
  });

  it("refuse un tableau de variations contradictoire avec le signe de la dérivée", () => {
    const r = validerFigure(EXEMPLE_FIGURE_INVALIDE);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erreurs.join(" ")).toMatch(/signe \+ incompatible avec « decroissante »/);
  });

  const casInvalides: [string, unknown, RegExp][] = [
    ["type inconnu", { type: "camembert" }, /Type de figure inconnu/],
    ["fenêtre inversée", { type: "repere", xMin: 5, xMax: 1, yMin: 0, yMax: 1, elements: [] }, /xMin doit être inférieur/],
    ["expression mal formée", { type: "repere", xMin: 0, xMax: 1, yMin: 0, yMax: 1, elements: [{ type: "courbe", expression: "x +* 2" }] }, /Expression/],
    [
      "tableau de signes mal dimensionné",
      { type: "tableau_signes", valeursX: ["−∞", "1", "+∞"], lignes: [{ libelle: "x − 1", signes: ["-"], marques: ["", "0", ""] }] },
      /il faut 2 signe/,
    ],
    ["point non défini", { type: "geometrie_plane", points: [{ nom: "A", x: 0, y: 0 }], segments: [{ de: "A", a: "B" }] }, /Point B non défini/],
    ["nom de point invalide", { type: "geometrie_plane", points: [{ nom: "abc", x: 0, y: 0 }] }, /majuscule/],
    [
      "probabilités qui ne somment pas à 1",
      { type: "arbre_probabilites", branches: [{ evenement: "A", probabilite: "0,3" }, { evenement: "Ā", probabilite: "0,6" }] },
      /somment à 0\.9/,
    ],
    ["quartiles désordonnés", { type: "diagramme_statistique", sousType: "boite_moustaches", min: 4, q1: 12, mediane: 11, q3: 13, max: 18 }, /min ≤ Q1/],
    [
      "classes non contiguës",
      { type: "diagramme_statistique", sousType: "histogramme", classes: [{ min: 0, max: 10, effectif: 3 }, { min: 12, max: 20, effectif: 4 }] },
      /non contiguës/,
    ],
    ["barres sans valeurs", { type: "diagramme_statistique", sousType: "barres", categories: ["a", "b"], valeurs: [1] }, /Autant de valeurs/],
  ];
  for (const [nom, figure, attendu] of casInvalides) {
    it(`refuse : ${nom}`, () => {
      const r = validerFigure(figure);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.erreurs.join(" ; ")).toMatch(attendu);
    });
  }

  it("probabilités symboliques (p, 1 − p) acceptées sans contrôle de somme", () => {
    const r = validerFigure({ type: "arbre_probabilites", branches: [{ evenement: "A", probabilite: "p" }, { evenement: "Ā", probabilite: "1 − p" }] });
    expect(r.ok).toBe(true);
    expect(valeurProbabilite("1/4")).toBe(0.25);
    expect(valeurProbabilite("0,3")).toBe(0.3);
    expect(valeurProbabilite("p")).toBeNull();
  });

  it("figureOptionnelleSchema : absente ou nulle acceptée, invalide refusée", () => {
    expect(figureOptionnelleSchema.safeParse(undefined).success).toBe(true);
    expect(figureOptionnelleSchema.safeParse(null).success).toBe(true);
    expect(figureOptionnelleSchema.safeParse(EXEMPLES_FIGURES[0]!.figure).success).toBe(true);
    expect(figureOptionnelleSchema.safeParse(EXEMPLE_FIGURE_INVALIDE).success).toBe(false);
  });
});
