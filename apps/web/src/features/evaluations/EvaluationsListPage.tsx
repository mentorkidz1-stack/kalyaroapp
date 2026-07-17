import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { useAuthStore } from "../../stores/auth";
import { AppHeader } from "../../components/AppHeader";
import { Card, Button, Badge, LoadingState, EmptyState, ErrorState } from "../../design-system";
import { useStreak } from "../streak/useStreak";

interface Matiere {
  id: string;
  nom: string;
}
interface EvaluationEleve {
  id: string;
  titre: string;
  dureeMinutes: number;
  bareme: number;
  maCopie: { id: string; statut: "EN_COURS" | "SOUMIS" | "CORRIGE"; noteObtenue: number | null } | null;
}

export function EvaluationsListPage() {
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
    data: evaluations,
    isLoading: isLoadingEvaluations,
    error: evaluationsError,
    refetch: refetchEvaluations,
  } = useQuery({
    queryKey: ["evaluations-eleve", matiereId],
    queryFn: () => api.get<EvaluationEleve[]>(`/api/eleve/matieres/${matiereId}/evaluations`),
    enabled: !!matiereId,
  });
  const { data: streakData } = useStreak();

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader title="Évaluations" subtitle="Kalyaro" streak={streakData?.streakCount} />
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
            {isLoadingEvaluations && <LoadingState label="Chargement des évaluations…" />}
            {!isLoadingEvaluations && evaluationsError && (
              <ErrorState message="Impossible de charger les évaluations." onRetry={() => refetchEvaluations()} />
            )}
            {!isLoadingEvaluations && !evaluationsError && (evaluations?.length ?? 0) === 0 && (
              <EmptyState icon="🗒️" message="Aucune évaluation pour cette matière." />
            )}
            {evaluations?.map((e) => (
              <Card key={e.id}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-semibold text-ink flex-1">{e.titre}</p>
                  {e.maCopie?.statut === "SOUMIS" && <Badge variant="warn">En attente de correction</Badge>}
                  {e.maCopie?.statut === "CORRIGE" && (
                    <Badge variant="ok">
                      {e.maCopie.noteObtenue} / {e.bareme}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-ink-soft mb-3">
                  {e.dureeMinutes} min · noté sur {e.bareme}
                </p>
                {!e.maCopie && (
                  <Button className="w-auto" onClick={() => navigate(`/evaluations/passage/${e.id}`)}>
                    Commencer
                  </Button>
                )}
                {e.maCopie?.statut === "EN_COURS" && (
                  <Button className="w-auto" onClick={() => navigate(`/evaluations/passage/${e.id}`)}>
                    Continuer
                  </Button>
                )}
                {e.maCopie && e.maCopie.statut !== "EN_COURS" && (
                  <Button
                    variant="ghost"
                    className="w-auto"
                    onClick={() => navigate(`/evaluations/copie/${e.maCopie!.id}`)}
                  >
                    Voir
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
