import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { formatMathText } from "../../lib/format-math";
import { useAuthStore } from "../../stores/auth";
import { AppHeader } from "../../components/AppHeader";
import { Card, Button, LoadingState, EmptyState, ErrorState } from "../../design-system";
import { useStreak } from "../streak/useStreak";

interface Matiere {
  id: string;
  nom: string;
}
interface Epreuve {
  id: string;
  enonce: string;
}

export function EpreuvesListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [matiereId, setMatiereId] = useState<string | null>(null);

  const {
    data: matieres,
    isLoading: isLoadingMatieres,
    error: matieresError,
    refetch: refetchMatieres,
  } = useQuery({
    queryKey: ["mes-matieres", user?.classeId, user?.niveauUniversitaireId],
    queryFn: () =>
      user?.classeId
        ? api.get<Matiere[]>(`/api/structure/classes/${user.classeId}/matieres`)
        : api.get<Matiere[]>(`/api/structure/niveaux/${user!.niveauUniversitaireId}/ue-matieres`),
    enabled: !!user?.classeId || !!user?.niveauUniversitaireId,
  });

  const {
    data: epreuves,
    isLoading: isLoadingEpreuves,
    error: epreuvesError,
    refetch: refetchEpreuves,
  } = useQuery({
    queryKey: ["epreuves-eleve", matiereId],
    queryFn: () => api.get<Epreuve[]>(`/api/eleve/matieres/${matiereId}/epreuves`),
    enabled: !!matiereId,
  });
  const { data: streakData } = useStreak();

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader title="Épreuves" subtitle="Kalyaro" streak={streakData?.streakCount} />
      <div className="max-w-lg mx-auto p-5 space-y-4">
        {isLoadingMatieres && <LoadingState label="Chargement de tes matières…" />}
        {!isLoadingMatieres && matieresError && (
          <ErrorState message="Impossible de charger tes matières." onRetry={() => refetchMatieres()} />
        )}
        {!isLoadingMatieres && !matieresError && (matieres?.length ?? 0) === 0 && (
          <EmptyState icon="📚" message="Aucune matière disponible pour l'instant." />
        )}
        {matieres && matieres.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {matieres.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMatiereId(m.id)}
                className={`px-3 py-2 rounded-[10px] border-2 text-sm font-bold ${
                  matiereId === m.id ? "border-primary bg-primary-tint text-primary-deep" : "border-line text-ink-soft"
                }`}
              >
                {m.nom}
              </button>
            ))}
          </div>
        )}

        {matiereId && (
          <div className="space-y-2">
            {isLoadingEpreuves && <LoadingState label="Chargement des épreuves…" />}
            {!isLoadingEpreuves && epreuvesError && (
              <ErrorState message="Impossible de charger les épreuves." onRetry={() => refetchEpreuves()} />
            )}
            {!isLoadingEpreuves && !epreuvesError && (epreuves?.length ?? 0) === 0 && (
              <EmptyState icon="📝" message="Aucune épreuve disponible pour cette matière pour l'instant." />
            )}
            {epreuves?.map((e) => (
              <Card key={e.id}>
                <p className="text-sm font-semibold text-ink mb-3">{formatMathText(e.enonce)}</p>
                <Button
                  className="w-auto"
                  onClick={() => navigate(`/epreuves/passage/${e.id}`, { state: { enonce: e.enonce } })}
                >
                  Commencer
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
