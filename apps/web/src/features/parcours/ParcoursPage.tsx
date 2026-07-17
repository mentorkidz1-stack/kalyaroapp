import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { AppHeader } from "../../components/AppHeader";
import { PathNode, Thread, LoadingState, EmptyState, ErrorState, type NodeState } from "../../design-system";
import { useStreak } from "../streak/useStreak";

interface NotionProgression {
  notionId: string;
  nom: string;
  statut: "NON_VU" | "FRAGILE" | "MAITRISE";
  verrouille: boolean;
}

const statutLabel: Record<NotionProgression["statut"], string> = {
  MAITRISE: "MAÎTRISÉ",
  FRAGILE: "EN COURS",
  NON_VU: "À DÉCOUVRIR",
};

export function ParcoursPage() {
  const { chapitreId } = useParams<{ chapitreId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["parcours", chapitreId],
    queryFn: () => api.get<NotionProgression[]>(`/api/eleve/chapitres/${chapitreId}/parcours`),
    enabled: !!chapitreId,
  });
  const { data: streakData } = useStreak();

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader title="Parcours" subtitle="Kalyaro" streak={streakData?.streakCount} />
      <div className="max-w-lg mx-auto p-5">
        {isLoading && <LoadingState label="Chargement du parcours…" />}
        {!isLoading && error && <ErrorState message="Impossible de charger ce parcours." onRetry={() => refetch()} />}
        {!isLoading && !error && (data?.length ?? 0) === 0 && (
          <EmptyState
            icon="🧭"
            title="Pas encore de notions"
            message="Ce chapitre n'a pas encore de notion publiée. Reviens un peu plus tard."
          />
        )}
        <div className="flex flex-col items-center gap-1">
          {data?.map((notion, index) => {
            const state: NodeState = notion.verrouille ? "locked" : notion.statut === "MAITRISE" ? "done" : "current";
            const sub = notion.verrouille ? "VERROUILLÉ" : statutLabel[notion.statut];
            return (
              <div key={notion.notionId} className="w-full">
                {index > 0 && <Thread />}
                <PathNode
                  state={state}
                  label={notion.nom}
                  sub={sub}
                  side={index % 2 === 0 ? "left" : "right"}
                  onClick={
                    state === "locked"
                      ? undefined
                      : () => navigate(`/parcours/${chapitreId}/qcm/${notion.notionId}`)
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
