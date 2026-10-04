import { useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { Button, Card, EmptyState, ErrorState, KpiTile, LoadingState, MasteryBadge } from "../../design-system";
import { useStreak } from "../streak/useStreak";
import { libelleRevisions, useRevisionsDues } from "./useRevisions";

export function RevisionsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useRevisionsDues();
  const { data: streakData } = useStreak();

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader title="Révisions du jour" subtitle="Kalyaro" streak={streakData?.streakCount} />
      <div className="max-w-lg mx-auto p-5 space-y-4">
        {isLoading && <LoadingState label="Chargement de tes révisions…" />}
        {!isLoading && error && (
          <ErrorState message="Impossible de charger tes révisions." onRetry={() => refetch()} />
        )}
        {data && data.nbQuestions === 0 && (
          <EmptyState
            icon="🌿"
            title="Rien à réviser aujourd'hui"
            message="Tu es à jour. Les notions que tu travailles dans tes cours reviendront ici au bon moment pour s'ancrer durablement."
            action={{ label: "Aller à mes cours", onClick: () => navigate("/cours") }}
          />
        )}
        {data && data.nbQuestions > 0 && (
          <>
            <Card>
              <p className="font-display font-bold text-base text-ink mb-1">{libelleRevisions(data.nbQuestions)}</p>
              <p className="text-sm text-ink-soft mb-4">
                Une séance courte qui mélange les notions à consolider. Revoir une notion au bon moment, c'est
                ce qui la fait tenir jusqu'au jour de l'examen.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <KpiTile value={data.nbQuestions} label="Questions" />
                <KpiTile value={`≈ ${data.dureeEstimeeMinutes} min`} label="Durée estimée" />
              </div>
              <Button onClick={() => navigate("/revisions/seance")}>Commencer ma séance</Button>
              {data.nbNotionsDues > new Set(data.seance).size && (
                <p className="text-xs text-ink-soft mt-3">
                  La séance est limitée à {data.nbQuestions} questions pour rester faisable : les autres notions
                  reviendront dans les prochaines séances.
                </p>
              )}
            </Card>
            <Card>
              <div className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-2">
                Notions à revoir ({data.nbNotionsDues})
              </div>
              <ul className="space-y-1.5">
                {data.notions.map((notion) => (
                  <li key={notion.notionId} className="flex justify-between items-center gap-3 text-sm">
                    <span className="text-ink">{notion.nom}</span>
                    <MasteryBadge statut={notion.statut} />
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
