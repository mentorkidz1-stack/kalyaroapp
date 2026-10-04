import { describe, expect, it } from "vitest";
import katex from "katex";
import { renderToStaticMarkup } from "react-dom/server";
import { MathText } from "../design-system/MathText";
import { decouperMath } from "./math-segments";
import { formatMathText } from "./format-math";
import { EXEMPLES_MATHS } from "./math-exemples";

const exemple = (titre: string) => EXEMPLES_MATHS.find((e) => e.titre.startsWith(titre))!.texte;

describe("decouperMath", () => {
  it("laisse un texte sans délimiteur en un seul segment de prose", () => {
    const texte = exemple("Texte Unicode");
    expect(decouperMath(texte)).toEqual([{ type: "texte", contenu: texte }]);
  });

  it("repère les formules en ligne et en bloc", () => {
    expect(decouperMath("Soit $\\frac{1}{2}$ puis $$x^2$$ fin")).toEqual([
      { type: "texte", contenu: "Soit " },
      { type: "en_ligne", tex: "\\frac{1}{2}" },
      { type: "texte", contenu: " puis " },
      { type: "bloc", tex: "x^2" },
      { type: "texte", contenu: " fin" },
    ]);
  });

  it("ne prend pas des montants pour des formules", () => {
    expect(decouperMath("Le livre coûte 5 $ et le cahier 3 $.")).toHaveLength(1);
    expect(decouperMath("Entre $5 et $10 de plus")).toHaveLength(1);
    expect(decouperMath("Payé $20$30 hier")).toHaveLength(1);
  });

  it("traite \\$ comme un dollar littéral", () => {
    expect(decouperMath("Prix : \\$10")).toEqual([{ type: "texte", contenu: "Prix : $10" }]);
  });

  it("ne traverse pas les retours à la ligne pour une formule en ligne", () => {
    expect(decouperMath("a $b\nc$ d")).toHaveLength(1);
  });

  it("laisse un $$ non fermé en prose", () => {
    expect(decouperMath("début $$x + 1")).toEqual([{ type: "texte", contenu: "début $$x + 1" }]);
  });

  // Cas réels observés dans les sorties de Gemini (octobre 2026).
  it("accepte les délimiteurs \\( … \\) et \\[ … \\] employés par l'IA", () => {
    expect(decouperMath(String.raw`Exprime le profit \(\pi(q)\).`)).toEqual([
      { type: "texte", contenu: "Exprime le profit " },
      { type: "en_ligne", tex: String.raw`\pi(q)` },
      { type: "texte", contenu: "." },
    ]);
    expect(decouperMath(String.raw`Calcule \[\int_0^1 x\,dx\]`)).toEqual([
      { type: "texte", contenu: "Calcule " },
      { type: "bloc", tex: String.raw`\int_0^1 x\,dx` },
    ]);
  });
});

describe("formatMathText (prose)", () => {
  it("convertit en Unicode les symboles LaTeX écrits hors formule", () => {
    expect(formatMathText(String.raw`\pi'(q) = 0 et \pi''(q) < 0`)).toBe("π'(q) = 0 et π''(q) < 0");
    expect(formatMathText(String.raw`x \leq 3 \times y, \Delta \neq 0`)).toBe("x ≤ 3 × y, Δ ≠ 0");
  });
  it("laisse intactes les commandes inconnues et les mots qui commencent pareil", () => {
    expect(formatMathText(String.raw`\frac{1}{2} et \pied`)).toBe(String.raw`\frac{1}{2} et \pied`);
  });
});

describe("rendu KaTeX des exemples de référence", () => {
  const formules = (texte: string) => decouperMath(texte).filter((s) => s.type !== "texte");
  const rendre = (tex: string, displayMode: boolean) =>
    katex.renderToString(tex, { displayMode, throwOnError: true, strict: false });

  for (const titre of ["Fraction", "Système", "Vecteur", "Intégrale", "Matrice"]) {
    it(`${titre} : toutes les formules sont valides`, () => {
      const segs = formules(exemple(titre));
      expect(segs.length).toBeGreaterThan(0);
      for (const s of segs) expect(() => rendre(s.tex, s.type === "bloc")).not.toThrow();
    });
  }

  it("produit les structures attendues (fraction, accolade du système, intégrale)", () => {
    expect(rendre("\\frac{3}{8}", false)).toContain("mfrac");
    expect(rendre("\\begin{cases} 2x + 3y = 7 \\\\ x - y = 1 \\end{cases}", true)).toContain("{");
    expect(rendre("\\int_{0}^{1} x\\,dx", true)).toContain("∫");
  });
});

describe("MathText", () => {
  it("affiche un texte Unicode existant exactement comme formatMathText", () => {
    for (const titre of ["Texte Unicode", "Ancienne notation", "Montants"]) {
      const texte = exemple(titre);
      const html = renderToStaticMarkup(<MathText text={texte} />);
      const attendu = renderToStaticMarkup(<span>{formatMathText(texte.replace("\\$", "$"))}</span>);
      expect(html.replace(/<\/?span>/g, "")).toBe(attendu.replace(/<\/?span>/g, ""));
    }
  });

  it("ne convertit pas x^2 en x² à l'intérieur d'une formule LaTeX", () => {
    const html = renderToStaticMarkup(<MathText text="Calcule $$\int_{0}^{1} 3x^2\,dx$$" />);
    expect(html).not.toContain("x²");
  });
});
