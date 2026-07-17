import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { formatMathText } from "../../lib/format-math";
import { AppHeader } from "../../components/AppHeader";
import { PhotoGallery } from "../../components/PhotoGallery";
import { AuthedPdfFrame } from "../../components/AuthedPdfFrame";
import { Card, Button, LoadingState, ErrorState } from "../../design-system";

interface CopieResponse {
  copieId: string;
  statut: "EN_COURS" | "SOUMIS" | "CORRIGE";
  reponsePhotoUrls: string[];
  noteObtenue: number | null;
  commentaireAdmin: string | null;
  pointsForts: string[];
  pointsATravailler: string[];
  evaluation: { id: string; titre: string; bareme: number; aUnPdf: boolean };
}

export function EvaluationResultPage() {
  const { copieId } = useParams<{ copieId: string }>();
  const navigate = useNavigate();

  const {
    data: copie,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["copie-eleve", copieId],
    queryFn: () => api.get<CopieResponse>(`/api/eleve/copies/${copieId}`),
    enabled: !!copieId,
    refetchInterval: (query) => (query.state.data?.statut === "SOUMIS" ? 5000 : false),
  });

  if (error && !copie) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader title="Évaluation" subtitle="Kalyaro" onBack={() => navigate("/evaluations")} />
        <div className="max-w-lg mx-auto p-5">
          <ErrorState message="Impossible de charger le résultat." onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  if (isLoading || !copie) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader title="Évaluation" subtitle="Kalyaro" />
        <div className="max-w-lg mx-auto p-5">
          <LoadingState label="Chargement du résultat…" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader title={copie.evaluation.titre} subtitle="Kalyaro" onBack={() => navigate("/evaluations")} />
      <div className="max-w-lg mx-auto p-5">
        {error && (
          <p className="text-xs text-alert text-center mb-3">
            Connexion instable — dernières données connues affichées.
          </p>
        )}
        <Card className="text-center py-8">
          {copie.evaluation.aUnPdf && (
            <AuthedPdfFrame src={`/api/eleve/evaluations/${copie.evaluation.id}/pdf`} />
          )}
          {copie.statut === "SOUMIS" && (
            <>
              <p className="font-display font-bold text-lg text-ink mb-2">Copie envoyée</p>
              <p className="text-sm text-ink-soft mb-6">En attente de correction par ton enseignant.</p>
            </>
          )}
          {copie.statut === "CORRIGE" && (
            <>
              <p className="font-display font-bold text-xl text-ink mb-2">
                {copie.noteObtenue} / {copie.evaluation.bareme}
              </p>
              {copie.commentaireAdmin && (
                <p className="text-sm text-ink-soft mb-4">{formatMathText(copie.commentaireAdmin)}</p>
              )}
              {copie.pointsForts.length > 0 && (
                <div className="text-left mb-4">
                  <div className="text-xs font-mono uppercase text-ink-soft mb-1">Points forts</div>
                  <ul className="text-sm text-ink list-disc list-inside">
                    {copie.pointsForts.map((point, i) => (
                      <li key={i}>{formatMathText(point)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {copie.pointsATravailler.length > 0 && (
                <div className="text-left mb-6">
                  <div className="text-xs font-mono uppercase text-ink-soft mb-1">À travailler</div>
                  <ul className="text-sm text-ink list-disc list-inside">
                    {copie.pointsATravailler.map((point, i) => (
                      <li key={i}>{formatMathText(point)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {copie.statut === "EN_COURS" && (
            <>
              <p className="font-display font-bold text-lg text-ink mb-2">Copie non envoyée</p>
              <p className="text-sm text-ink-soft mb-6">Cette évaluation n'a pas encore été soumise.</p>
            </>
          )}
          {copie.reponsePhotoUrls.length > 0 && (
            <div className="text-left mb-6">
              <div className="text-xs font-mono uppercase text-ink-soft mb-1">Tes photos</div>
              <PhotoGallery
                srcs={copie.reponsePhotoUrls.map((_, i) => `/api/eleve/copies/${copieId}/photo/${i}`)}
                altPrefix="Photo de ta réponse"
              />
            </div>
          )}
          <Button onClick={() => navigate("/evaluations")}>Retour aux évaluations</Button>
        </Card>
      </div>
    </div>
  );
}
