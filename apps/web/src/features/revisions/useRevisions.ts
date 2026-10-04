import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import type { NiveauMaitrise } from "../../design-system";

export interface NotionDue {
  notionId: string;
  nom: string;
  chapitreId: string;
  statut: Exclude<NiveauMaitrise, "NON_VU">;
  nbEchecsConsecutifs: number;
  prochaineRevisionAt: string;
}

export interface RevisionsDues {
  nbNotionsDues: number;
  nbQuestions: number;
  dureeEstimeeMinutes: number;
  notions: NotionDue[];
  /** Une entrée par question de la séance : la notion à interroger, déjà mélangée. */
  seance: string[];
}

export const REVISIONS_DUES_KEY = ["revisions-dues"] as const;

export function useRevisionsDues() {
  return useQuery({
    queryKey: REVISIONS_DUES_KEY,
    queryFn: () => api.get<RevisionsDues>("/api/eleve/revisions/dues"),
  });
}

export function libelleRevisions(nbQuestions: number): string {
  return nbQuestions === 1 ? "1 révision t'attend aujourd'hui" : `${nbQuestions} révisions t'attendent aujourd'hui`;
}
