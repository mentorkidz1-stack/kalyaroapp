import type { Confiance } from "./mastery.js";

// Indice de lucidité (chantier 3.1) : l'élève sait-il ce qu'il sait ? Fonction pure.
//
// Chaque confiance déclarée vaut une probabilité de réussite annoncée ; on la compare au
// résultat réel (score de Brier) : 100 = parfaitement lucide (sûr quand il réussit, « au
// hasard » quand il se trompe). Le biais (réussite annoncée − réussite réelle) dit dans quel
// sens il se trompe sur lui-même.

/** Probabilité de réussite qu'exprime chaque niveau de confiance. */
export const PROBABILITE_ANNONCEE: Record<Confiance, number> = { SUR: 0.9, HESITE: 0.6, HASARD: 0.25 };
/** En dessous, l'indice serait trop instable pour être montré. */
export const MIN_REPONSES_LUCIDITE = 10;
/** Écart moyen à partir duquel on parle de sur- ou de sous-estimation. */
export const SEUIL_BIAIS = 0.15;

export type Tendance = "SURESTIME" | "SOUS_ESTIME" | "JUSTE";

export interface ReponseConfiance {
  confiance: Confiance;
  correcte: boolean;
}

export interface Lucidite {
  nbReponses: number;
  /** 0 à 100 ; null tant qu'il n'y a pas assez de réponses. */
  indice: number | null;
  tendance: Tendance | null;
  /** Taux de réussite réel pour chaque confiance déclarée (null si aucune réponse). */
  reussiteParConfiance: Record<Confiance, { reponses: number; taux: number | null }>;
  /** Erreurs commises en se déclarant sûr : les plus importantes à corriger. */
  erreursAssurees: number;
}

export function calculerLucidite(reponses: ReponseConfiance[]): Lucidite {
  const parConfiance = { SUR: [0, 0], HESITE: [0, 0], HASARD: [0, 0] } as Record<Confiance, [number, number]>;
  let ecartCarre = 0;
  let annonce = 0;
  let reel = 0;
  let erreursAssurees = 0;
  for (const r of reponses) {
    const p = PROBABILITE_ANNONCEE[r.confiance];
    const o = r.correcte ? 1 : 0;
    ecartCarre += (p - o) ** 2;
    annonce += p;
    reel += o;
    parConfiance[r.confiance][0] += 1;
    parConfiance[r.confiance][1] += o;
    if (r.confiance === "SUR" && !r.correcte) erreursAssurees += 1;
  }
  const n = reponses.length;
  const reussiteParConfiance = Object.fromEntries(
    (Object.keys(parConfiance) as Confiance[]).map((c) => {
      const [total, reussies] = parConfiance[c];
      return [c, { reponses: total, taux: total ? reussies / total : null }];
    })
  ) as Lucidite["reussiteParConfiance"];

  if (n < MIN_REPONSES_LUCIDITE) {
    return { nbReponses: n, indice: null, tendance: null, reussiteParConfiance, erreursAssurees };
  }
  const biais = (annonce - reel) / n;
  return {
    nbReponses: n,
    indice: Math.round(100 * (1 - ecartCarre / n)),
    tendance: biais > SEUIL_BIAIS ? "SURESTIME" : biais < -SEUIL_BIAIS ? "SOUS_ESTIME" : "JUSTE",
    reussiteParConfiance,
    erreursAssurees,
  };
}
