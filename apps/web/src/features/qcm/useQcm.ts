import { useEffect, useRef, useState } from "react";
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
  tentativeId: string;
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

// explainQcmAnswer retries up to 3 times on a malformed response (1.5s delay between
// retries, plus the call itself) — worst case comfortably exceeds 15s, so the poll
// window needs real margin above that rather than matching only the common case.
const INDICE_POLL_MAX_ATTEMPTS = 16;
const INDICE_POLL_INTERVAL_MS = 1500;

/**
 * L'indice d'une mauvaise réponse est généré en arrière-plan côté serveur (voir
 * submitQcmAnswer) pour ne pas faire attendre l'élève sur l'appel IA avant de savoir
 * s'il a juste ou faux. Ce hook va le chercher par courts sondages une fois prêt.
 */
export function useTentativeIndice(tentativeId: string | null) {
  const attemptsRef = useRef(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    attemptsRef.current = 0;
    setExhausted(false);
  }, [tentativeId]);

  const query = useQuery({
    queryKey: ["tentative-indice", tentativeId],
    queryFn: () => api.get<{ indice: string | null }>(`/api/eleve/qcm/tentatives/${tentativeId}/indice`),
    enabled: !!tentativeId,
    refetchInterval: (q) => {
      if (q.state.data?.indice) return false;
      attemptsRef.current += 1;
      if (attemptsRef.current > INDICE_POLL_MAX_ATTEMPTS) {
        setExhausted(true);
        return false;
      }
      return INDICE_POLL_INTERVAL_MS;
    },
  });

  return { indice: query.data?.indice ?? null, exhausted };
}
