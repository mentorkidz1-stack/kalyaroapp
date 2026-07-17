import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api-client";
import { AppHeader } from "../../components/AppHeader";
import { Card, LoadingState, EmptyState, ErrorState } from "../../design-system";
import { useStreak } from "../streak/useStreak";

interface Chapitre {
  id: string;
  titre: string;
  ordre: number;
}
interface Cours {
  id: string;
  titre: string;
  chapitres: Chapitre[];
}

export function MesCoursPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["mes-cours"],
    queryFn: () => api.get<Cours[]>("/api/eleve/mes-cours"),
  });
  const { data: streakData } = useStreak();

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader title="Mes cours" subtitle="Kalyaro" streak={streakData?.streakCount} />
      <div className="max-w-lg mx-auto p-5">
        {isLoading && <LoadingState label="Chargement de tes cours…" />}
        {!isLoading && error && (
          <ErrorState message="Impossible de charger tes cours." onRetry={() => refetch()} />
        )}
        {!isLoading && !error && (data?.length ?? 0) === 0 && (
          <EmptyState
            icon="📘"
            title="Rien à afficher pour l'instant"
            message="Aucun cours n'est encore disponible pour ta classe. Reviens un peu plus tard."
          />
        )}
        <div className="space-y-4">
          {data?.map((cours) => (
            <Card key={cours.id}>
              <div className="font-display font-bold text-base text-ink mb-3">{cours.titre}</div>
              {cours.chapitres.length === 0 ? (
                <p className="text-sm text-ink-soft">Ce cours n'a pas encore de chapitre publié.</p>
              ) : (
                <div className="space-y-2">
                  {cours.chapitres
                    .slice()
                    .sort((a, b) => a.ordre - b.ordre)
                    .map((chapitre) => (
                      <button
                        key={chapitre.id}
                        type="button"
                        onClick={() => navigate(`/parcours/${chapitre.id}`)}
                        className="block w-full text-left px-4 py-3 rounded-[14px] border-2 border-line hover:border-primary font-sans font-semibold text-sm text-ink transition-colors"
                      >
                        {chapitre.titre}
                      </button>
                    ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
