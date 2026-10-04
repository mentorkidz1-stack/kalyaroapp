import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { formatMathText } from "../../lib/format-math";
import { AppHeader } from "../../components/AppHeader";
import {
  Button,
  Card,
  ChoiceButton,
  EmptyState,
  ErrorState,
  FeedbackBlock,
  LoadingState,
  MasteryBadge,
  MasteryCelebration,
  niveauAMonte,
} from "../../design-system";
import { useSubmitQcm, useTentativeIndice, type NextQcm, type RepondreResult } from "../qcm/useQcm";
import { REVISIONS_DUES_KEY, type RevisionsDues } from "./useRevisions";

export function RevisionSessionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Le plan est figé au démarrage : chaque réponse reprogramme la notion côté serveur, un
  // rechargement du plan en cours de séance la ferait disparaître ou changer d'ordre.
  const planQuery = useQuery({
    queryKey: ["revisions-seance"],
    queryFn: () => api.get<RevisionsDues>("/api/eleve/revisions/dues"),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const plan = planQuery.data?.seance ?? [];

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<RepondreResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Dernier résultat par notion : une notion est « consolidée » si sa dernière réponse de la séance est juste.
  const [derniereReponse, setDerniereReponse] = useState<Record<string, boolean>>({});

  const notionId = plan[index];
  const termine = planQuery.isSuccess && index >= plan.length;

  const questionQuery = useQuery({
    queryKey: ["revision-question", index, notionId],
    queryFn: () => api.get<NextQcm | null>(`/api/eleve/notions/${notionId}/qcm/next`),
    enabled: !!notionId,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const question = questionQuery.data;

  const submitMutation = useSubmitQcm();
  const submittingRef = useRef(false);
  const { indice, exhausted: indiceExhausted } = useTentativeIndice(
    result && !result.correcte ? result.tentativeId : null
  );

  // Notion devenue sans question publiée depuis le calcul du plan : on passe à la suivante.
  useEffect(() => {
    if (questionQuery.isSuccess && question === null) setIndex((i) => i + 1);
  }, [questionQuery.isSuccess, question]);

  useEffect(() => {
    if (termine) queryClient.invalidateQueries({ queryKey: REVISIONS_DUES_KEY });
  }, [termine, queryClient]);

  function handleChoice(choix: string) {
    if (result || !question || !notionId || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    setSelected(choix);
    submitMutation.mutate(
      { attemptToken: question.attemptToken, reponseDonnee: choix },
      {
        onSuccess: (data) => {
          submittingRef.current = false;
          setResult(data);
          setDerniereReponse((prev) => ({ ...prev, [notionId]: data.correcte }));
        },
        onError: () => {
          submittingRef.current = false;
          setSelected(null);
          setSubmitError("Ta réponse n'a pas pu être envoyée. Réessaie.");
        },
      }
    );
  }

  function handleContinue() {
    setSelected(null);
    setResult(null);
    setSubmitError(null);
    setIndex((i) => i + 1);
  }

  const quitter = () => navigate("/revisions");

  if (termine) {
    const notionsVues = Object.keys(derniereReponse).length;
    const consolidees = Object.values(derniereReponse).filter(Boolean).length;
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader title="Séance terminée" subtitle="Révisions du jour" onBack={quitter} />
        <div className="max-w-lg mx-auto p-5">
          <MasteryCelebration
            title="Séance terminée"
            message={
              notionsVues === 0
                ? "Il n'y avait finalement rien à réviser. Tu es à jour."
                : `${consolidees} ${consolidees > 1 ? "notions consolidées" : "notion consolidée"} sur ${notionsVues}. ` +
                  (consolidees < notionsVues
                    ? "Les notions encore fragiles reviendront demain : c'est comme ça qu'elles finissent par tenir."
                    : "Belle régularité, continue comme ça.")
            }
          >
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate("/cours")}>Retour à mes cours</Button>
              <Button variant="ghost" onClick={quitter}>
                Voir mes révisions
              </Button>
            </div>
          </MasteryCelebration>
        </div>
      </div>
    );
  }

  const enChargement = planQuery.isLoading || (!!notionId && (questionQuery.isLoading || question === null));

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader
        title="Révisions du jour"
        subtitle={plan.length > 0 ? `Question ${Math.min(index + 1, plan.length)} / ${plan.length}` : "Révisions"}
        onBack={quitter}
      />
      <div className="max-w-lg mx-auto p-5">
        {enChargement && <LoadingState label="Chargement de la question…" />}
        {planQuery.error && <ErrorState message="Impossible de préparer ta séance." onRetry={() => planQuery.refetch()} />}
        {!enChargement && questionQuery.error && (
          <ErrorState message="Impossible de charger cette question." onRetry={() => questionQuery.refetch()} />
        )}
        {planQuery.isSuccess && plan.length === 0 && (
          <EmptyState
            icon="🌿"
            title="Rien à réviser aujourd'hui"
            message="Tu es à jour."
            action={{ label: "Retour", onClick: quitter }}
          />
        )}
        {question && !enChargement && (
          <Card>
            <h3 className="font-display text-[19px] leading-snug text-ink mb-4">{formatMathText(question.enonce)}</h3>
            {question.choix.map((choix) => {
              const state = result && selected === choix ? (result.correcte ? "correct" : "wrong") : "default";
              return (
                <ChoiceButton
                  key={choix}
                  state={state}
                  disabled={!!result || submitMutation.isPending}
                  onClick={() => handleChoice(choix)}
                >
                  {formatMathText(choix)}
                </ChoiceButton>
              );
            })}

            {submitError && (
              <div className="mt-3">
                <ErrorState message={submitError} />
              </div>
            )}

            {result && (
              <div className="fade-in">
                <FeedbackBlock variant={result.correcte ? "ok" : "warn"}>
                  {result.correcte
                    ? "Bien joué, c'est la bonne réponse !"
                    : indice
                      ? formatMathText(indice)
                      : indiceExhausted
                        ? "Pas tout à fait — cette notion reviendra demain."
                        : "Pas tout à fait… un instant, on prépare une explication."}
                </FeedbackBlock>
                {niveauAMonte(result.statutPrecedent, result.statutNotion) && (
                  <p className="mt-2 text-sm text-ink flex items-center gap-2">
                    Niveau atteint : <MasteryBadge statut={result.statutNotion} />
                  </p>
                )}
              </div>
            )}

            {result?.ficheResume && (
              <Card className="mt-4 bg-accent-tint border-accent fade-in">
                <div className="font-mono text-[11px] uppercase tracking-wide text-[#8A5A0E] mb-2">Fiche résumé</div>
                <div className="text-sm text-ink whitespace-pre-wrap">{formatMathText(result.ficheResume.contenu)}</div>
              </Card>
            )}

            {result && (
              <div className="mt-4">
                <Button onClick={handleContinue}>
                  {index + 1 >= plan.length ? "Terminer la séance" : "Question suivante →"}
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
