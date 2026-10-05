import { describe, expect, it } from "vitest";
import { calculerLucidite, MIN_REPONSES_LUCIDITE, type ReponseConfiance } from "./lucidite.js";

const fois = (n: number, r: ReponseConfiance) => Array.from({ length: n }, () => r);

describe("calculerLucidite", () => {
  it("n'affiche pas d'indice avec trop peu de réponses", () => {
    const l = calculerLucidite(fois(MIN_REPONSES_LUCIDITE - 1, { confiance: "SUR", correcte: true }));
    expect(l.indice).toBeNull();
    expect(l.tendance).toBeNull();
    expect(l.nbReponses).toBe(MIN_REPONSES_LUCIDITE - 1);
  });

  it("récompense l'élève qui sait ce qu'il sait", () => {
    const lucide = calculerLucidite([
      ...fois(6, { confiance: "SUR", correcte: true }),
      ...fois(6, { confiance: "HASARD", correcte: false }),
    ]);
    expect(lucide.indice).toBeGreaterThanOrEqual(95);
    expect(lucide.tendance).toBe("JUSTE");
  });

  it("repère la surestimation (sûr et pourtant faux)", () => {
    const l = calculerLucidite([
      ...fois(8, { confiance: "SUR", correcte: false }),
      ...fois(4, { confiance: "SUR", correcte: true }),
    ]);
    expect(l.tendance).toBe("SURESTIME");
    expect(l.erreursAssurees).toBe(8);
    expect(l.indice!).toBeLessThan(50);
    expect(l.reussiteParConfiance.SUR).toEqual({ reponses: 12, taux: 4 / 12 });
    expect(l.reussiteParConfiance.HESITE).toEqual({ reponses: 0, taux: null });
  });

  it("repère la sous-estimation (« au hasard » mais juste)", () => {
    const l = calculerLucidite(fois(12, { confiance: "HASARD", correcte: true }));
    expect(l.tendance).toBe("SOUS_ESTIME");
  });
});
