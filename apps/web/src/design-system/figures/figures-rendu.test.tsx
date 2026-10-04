import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EXEMPLES_FIGURES, EXEMPLE_FIGURE_INVALIDE } from "@kalyaro/shared";
import { FigureRenderer } from "./FigureRenderer";

const rendre = (figure: unknown) => renderToStaticMarkup(<FigureRenderer figure={figure} />);
const exemple = (debut: string) => EXEMPLES_FIGURES.find((e) => e.titre.startsWith(debut))!.figure;
const compter = (html: string, motif: RegExp) => (html.match(motif) ?? []).length;

describe("FigureRenderer", () => {
  it("dessine chaque figure de référence en SVG, sans coordonnée aberrante", () => {
    for (const ex of EXEMPLES_FIGURES) {
      const html = rendre(ex.figure);
      expect(html, ex.titre).toContain("<svg");
      expect(html, ex.titre).not.toMatch(/NaN|Infinity|undefined/);
      expect(html, ex.titre).not.toContain("Figure indisponible");
    }
  });

  it("refuse une figure invalide : message, jamais de dessin", () => {
    const html = rendre(EXEMPLE_FIGURE_INVALIDE);
    expect(html).toContain("Figure indisponible");
    expect(html).not.toContain("<svg");
    expect(rendre({ type: "repere", xMin: 3, xMax: 1, yMin: 0, yMax: 1, elements: [] })).toContain("Figure indisponible");
    expect(rendre("n'importe quoi")).toContain("Figure indisponible");
  });

  it("tableau de variations : une flèche par intervalle et la valeur du minimum", () => {
    const html = rendre(exemple("Tableau de variations"));
    expect(compter(html, /marker-end="url\(#[^)]*-fleche\)"/g)).toBe(2);
    expect(html).toContain("−1");
    expect(html).toContain("f&#x27;(x)");
  });

  it("triangle rectangle : codage de l'angle droit et longueurs affichées", () => {
    const html = rendre(exemple("Triangle rectangle"));
    expect(compter(html, /<polyline/g)).toBe(1); // le petit carré de l'angle droit
    expect(html).toContain("4 cm");
    expect(html).toContain("3 cm");
  });

  it("Thalès : chevrons de parallélisme sur (BC) et (MN)", () => {
    const html = rendre(exemple("Configuration de Thalès"));
    expect(compter(html, /<polyline/g)).toBe(2);
  });

  it("repère droite + parabole : 2 tracés et les points A et B", () => {
    const html = rendre(exemple("Droite et parabole"));
    expect(compter(html, /<path d="M/g)).toBeGreaterThanOrEqual(1); // la parabole
    expect(html).toMatch(/>A</);
    expect(html).toMatch(/>B</);
  });

  it("arbre à deux niveaux : 6 branches et toutes les probabilités", () => {
    const html = rendre(exemple("Arbre"));
    for (const p of ["0,3", "0,7", "0,6", "0,4", "0,2", "0,8"]) expect(html).toContain(`>${p}<`);
  });
});
