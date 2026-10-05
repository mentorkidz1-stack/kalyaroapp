import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import type { Confiance } from "../../design-system";

export interface LuciditeMatiere {
  matiereId: string;
  matiereNom: string;
  nbReponses: number;
  indice: number | null;
  tendance: "SURESTIME" | "SOUS_ESTIME" | "JUSTE" | null;
  reussiteParConfiance: Record<Confiance, { reponses: number; taux: number | null }>;
  erreursAssurees: number;
}

/** Même seuil que l'API (lucidite.ts) : en dessous, pas d'indice affiché. */
const MIN_REPONSES = 10;

export function useLucidite() {
  return useQuery({ queryKey: ["lucidite"], queryFn: () => api.get<LuciditeMatiere[]>("/api/eleve/lucidite") });
}

const TENDANCES = {
  SURESTIME: "Tu as tendance à te surestimer : quand tu te sens sûr, vérifie une dernière fois.",
  SOUS_ESTIME: "Tu en sais plus que tu ne le crois : fais-toi un peu plus confiance.",
  JUSTE: "Tu sais bien ce que tu sais. Continue comme ça !",
};
const LIBELLES: Record<Confiance, string> = { SUR: "« Sûr »", HESITE: "« J'hésite »", HASARD: "« Au hasard »" };

/**
 * Indice de lucidité d'une matière (chantier 3.1) : l'élève sait-il ce qu'il sait ?
 * Rien n'est affiché tant qu'il n'a déclaré aucune confiance dans la matière.
 */
export function BlocLucidite({ lucidite }: { lucidite: LuciditeMatiere | undefined }) {
  const [details, setDetails] = useState(false);
  if (!lucidite || lucidite.nbReponses === 0) return null;

  if (lucidite.indice === null) {
    const reste = MIN_REPONSES - lucidite.nbReponses;
    return (
      <p className="mt-3 text-xs text-ink-soft">
        🎯 Lucidité : encore {reste} réponse{reste > 1 ? "s" : ""} pour la mesurer.
      </p>
    );
  }
  return (
    <div className="mt-3 rounded-[12px] bg-bg p-3 text-sm">
      <button type="button" className="w-full text-left" onClick={() => setDetails((d) => !d)} aria-expanded={details}>
        <span className="font-bold text-ink">🎯 Lucidité : {lucidite.indice}/100</span>
        <span className="block text-ink-soft text-xs mt-0.5">{lucidite.tendance && TENDANCES[lucidite.tendance]}</span>
      </button>
      {details && (
        <ul className="mt-2 space-y-0.5 text-xs text-ink">
          {(Object.keys(LIBELLES) as Confiance[]).map((c) => {
            const r = lucidite.reussiteParConfiance[c];
            return r.reponses > 0 && r.taux !== null ? (
              <li key={c}>
                Quand tu dis {LIBELLES[c]}, tu réussis {Math.round(r.taux * 100)} % du temps ({r.reponses} réponse
                {r.reponses > 1 ? "s" : ""}).
              </li>
            ) : null;
          })}
          {lucidite.erreursAssurees > 0 && (
            <li className="text-alert">
              {lucidite.erreursAssurees} erreur{lucidite.erreursAssurees > 1 ? "s" : ""} commise
              {lucidite.erreursAssurees > 1 ? "s" : ""} en étant sûr : ce sont les plus importantes à corriger.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
