import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

export interface NextQcm {
  enonce: string;
  choix: string[];
  attemptToken: string;
  reformulee: boolean;
}
export interface FicheResume {
  id: string;
  contenu: string;
  statut: string;
}
export interface QuestionMetacognitive {
  id: string;
  enonce: string;
  tentativeId: string;
}
export interface RepondreResult {
  correcte: boolean;
  statutNotion: "NON_VU" | "FRAGILE" | "MAITRISE";
  ficheResume: FicheResume | null;
  questionMetacognitive: QuestionMetacognitive | null;
  indice: string | null;
}

export function useQcmNext(notionId: string | undefined) {
  return useQuery({
    queryKey: ["qcm-next", notionId],
    queryFn: () => api.get<NextQcm>(`/api/eleve/notions/${notionId}/qcm/next`),
    enabled: !!notionId,
  });
}

export function useSubmitQcm() {
  return useMutation({
    mutationFn: ({ attemptToken, reponseDonnee }: { attemptToken: string; reponseDonnee: string }) =>
      api.post<RepondreResult>("/api/eleve/qcm/repondre", { attemptToken, reponseDonnee }),
  });
}
