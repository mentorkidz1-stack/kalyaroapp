import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { AppHeader } from "../../components/AppHeader";
import {
  Button,
  Card,
  ChoixConfiance,
  ClavierMaths,
  FeedbackBlock,
  LoadingState,
  EmptyState,
  ErrorState,
  MathText,
  FigureRenderer,
  type Confiance,
} from "../../design-system";

interface NextSaisieLibre {
  id: string;
  enonce: string;
  figure?: unknown;
}
interface RepondreResult {
  valide: boolean;
  explication: string;
}

export function SaisieLibrePage() {
  const { chapitreId, notionId } = useParams<{ chapitreId: string; notionId: string }>();
  const navigate = useNavigate();
  const [reponse, setReponse] = useState("");
  const zoneReponse = useRef<HTMLTextAreaElement>(null);
  const [result, setResult] = useState<RepondreResult | null>(null);
  const [confiance, setConfiance] = useState<Confiance | null>(null);

  const {
    data: question,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["saisie-libre-next", notionId],
    queryFn: () => api.get<NextSaisieLibre>(`/api/eleve/notions/${notionId}/saisie-libre/next`),
    enabled: !!notionId,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: (c: Confiance) =>
      api.post<RepondreResult>("/api/eleve/saisie-libre/repondre", {
        questionSaisieLibreId: question!.id,
        reponseDonnee: reponse,
        confiance: c,
      }),
    onSuccess: (data) => setResult(data),
  });

  async function handleContinue() {
    setReponse("");
    setResult(null);
    setConfiance(null);
    await refetch();
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader
        title="Saisie libre"
        subtitle="Kalyaro"
        variant="deep"
        onBack={() => navigate(`/parcours/${chapitreId}`)}
      />
      <div className="max-w-lg mx-auto p-5">
        {isLoading && <LoadingState label="Chargement de la question…" />}

        {error instanceof ApiError && error.status === 403 && (
          <EmptyState
            icon="🔒"
            message="Cette notion n'est pas encore maîtrisée — continue à t'entraîner en QCM avant de tenter la saisie libre."
            action={{
              label: "Retour au QCM",
              onClick: () => navigate(`/parcours/${chapitreId}/qcm/${notionId}`),
            }}
          />
        )}

        {error instanceof ApiError && error.status === 404 && (
          <EmptyState
            icon="✍️"
            message="Aucune question à saisie libre n'est encore publiée pour cette notion. Reviens un peu plus tard."
            action={{ label: "Retour au parcours", onClick: () => navigate(`/parcours/${chapitreId}`) }}
          />
        )}

        {error instanceof ApiError && error.status !== 403 && error.status !== 404 && (
          <ErrorState message="Impossible de charger cette question." onRetry={() => refetch()} />
        )}
        {error && !(error instanceof ApiError) && (
          <ErrorState message="Impossible de charger cette question." onRetry={() => refetch()} />
        )}

        {question && (
          <Card>
            <h3 className="font-display text-[19px] leading-snug text-ink mb-4"><MathText text={question.enonce} /></h3>
            {question.figure != null && <FigureRenderer figure={question.figure} />}
            {!result && <ClavierMaths zone={zoneReponse} onInsertion={setReponse} />}
            <textarea
              ref={zoneReponse}
              value={reponse}
              onChange={(e) => setReponse(e.target.value)}
              disabled={!!result}
              placeholder="Écris ta réponse ici…"
              className="w-full min-h-[100px] rounded-[14px] border-2 border-line p-3 font-sans text-sm focus:outline-none focus:border-primary disabled:opacity-70"
            />

            {result && (
              <FeedbackBlock variant={result.valide ? "ok" : "warn"}><MathText text={result.explication} /></FeedbackBlock>
            )}
            {result && !result.valide && confiance === "SUR" && (
              <p className="mt-2 text-sm font-semibold text-alert">Tu étais sûr — c'est l'erreur la plus importante à corriger.</p>
            )}

            <div className="mt-4">
              {result ? (
                <Button onClick={handleContinue}>Continuer →</Button>
              ) : (
                reponse.trim() && (
                  <>
                    <ChoixConfiance
                      disabled={submitMutation.isPending}
                      enCours={submitMutation.isPending ? confiance : null}
                      onChoix={(c) => {
                        setConfiance(c);
                        submitMutation.mutate(c);
                      }}
                    />
                    {submitMutation.isPending && <p className="text-sm text-ink-soft text-center">Vérification…</p>}
                  </>
                )
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
