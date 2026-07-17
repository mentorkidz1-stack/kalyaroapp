import { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { formatMathText } from "../../lib/format-math";
import { AppHeader } from "../../components/AppHeader";
import {
  Button,
  Card,
  ChoiceButton,
  FeedbackBlock,
  LoadingState,
  EmptyState,
  ErrorState,
  MasteryCelebration,
} from "../../design-system";
import { useQcmNext, useSubmitQcm, useTentativeIndice, type RepondreResult } from "./useQcm";

interface QcmLocationState {
  returnToEpreuve?: { epreuveId: string; enonce: string };
}

export function QcmSessionPage() {
  const { chapitreId, notionId } = useParams<{ chapitreId: string; notionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const returnToEpreuve = (location.state as QcmLocationState | null)?.returnToEpreuve;

  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<RepondreResult | null>(null);
  const [metaReponse, setMetaReponse] = useState("");
  const [metaSubmitted, setMetaSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { data: question, isLoading, error, refetch } = useQcmNext(notionId);

  const submitMutation = useSubmitQcm();
  // useMutation's isPending only updates on React's next render, which is too slow to
  // block a rapid double-click/double-tap that fires before that render happens — a ref
  // is set synchronously on the very first call, closing the race entirely.
  const submittingRef = useRef(false);

  const { indice: polledIndice, exhausted: indicePollExhausted } = useTentativeIndice(
    result && !result.correcte ? result.tentativeId : null
  );

  const metaMutation = useMutation({
    mutationFn: () =>
      api.post("/api/eleve/metacognitif/repondre", {
        questionMetacognitiveId: result!.questionMetacognitive!.id,
        tentativeId: result!.questionMetacognitive!.tentativeId,
        reponseTexte: metaReponse,
      }),
    onSuccess: () => setMetaSubmitted(true),
  });

  function handleChoice(choix: string) {
    if (result || !question || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitError(null);
    setSelected(choix);
    submitMutation.mutate(
      { attemptToken: question.attemptToken, reponseDonnee: choix },
      {
        onSuccess: (data) => {
          submittingRef.current = false;
          setResult(data);
        },
        onError: () => {
          submittingRef.current = false;
          setSelected(null);
          setSubmitError("Ta réponse n'a pas pu être envoyée. Réessaie.");
        },
      }
    );
  }

  async function handleContinue() {
    setIsTransitioning(true);
    await new Promise((resolve) => setTimeout(resolve, 150));
    setSelected(null);
    setResult(null);
    setMetaReponse("");
    setMetaSubmitted(false);
    setSubmitError(null);
    await refetch();
    setIsTransitioning(false);
  }

  if (result?.statutNotion === "MAITRISE") {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader title="Bravo !" subtitle="Notion maîtrisée" onBack={() => navigate(`/parcours/${chapitreId}`)} />
        <div className="max-w-lg mx-auto p-5">
          <MasteryCelebration
            title="Notion maîtrisée !"
            message="Tu as répondu juste 3 fois d'affilée — tu peux maintenant t'entraîner en saisie libre sur cette notion, ou continuer ton parcours."
          >
            <div className="flex flex-col gap-2">
              {returnToEpreuve && (
                <Button
                  onClick={() =>
                    navigate(`/epreuves/passage/${returnToEpreuve.epreuveId}`, {
                      state: { enonce: returnToEpreuve.enonce },
                    })
                  }
                >
                  Retourner à l'épreuve
                </Button>
              )}
              <Button
                variant={returnToEpreuve ? "ghost" : "primary"}
                onClick={() => navigate(`/parcours/${chapitreId}/saisie-libre/${notionId}`)}
              >
                Essayer la saisie libre
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/parcours/${chapitreId}`)}>
                Retour au parcours
              </Button>
            </div>
          </MasteryCelebration>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader title="Question" subtitle="QCM · Kalyaro" onBack={() => navigate(`/parcours/${chapitreId}`)} />
      <div className="max-w-lg mx-auto p-5">
        {isLoading && <LoadingState label="Chargement de la question…" />}
        {!isLoading && error && (
          <ErrorState message="Impossible de charger cette question." onRetry={() => refetch()} />
        )}
        {!isLoading && !error && !question && (
          <EmptyState
            icon="❓"
            title="Aucune question disponible"
            message="Il n'y a pas encore de question pour cette notion. Reviens un peu plus tard."
            action={{ label: "Retour au parcours", onClick: () => navigate(`/parcours/${chapitreId}`) }}
          />
        )}
        {question && (
          <Card className={`transition-opacity duration-150 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
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
                    : polledIndice
                      ? formatMathText(polledIndice)
                      : indicePollExhausted
                        ? "Pas tout à fait — retente une prochaine fois."
                        : "Pas tout à fait… un instant, on prépare une explication."}
                </FeedbackBlock>
              </div>
            )}

            {result?.ficheResume && (
              <Card className="mt-4 bg-accent-tint border-accent fade-in">
                <div className="font-mono text-[11px] uppercase tracking-wide text-[#8A5A0E] mb-2">
                  Fiche résumé
                </div>
                <div className="text-sm text-ink whitespace-pre-wrap">{formatMathText(result.ficheResume.contenu)}</div>
              </Card>
            )}

            {result?.questionMetacognitive && !metaSubmitted && (
              <Card className="mt-4 fade-in">
                <p className="text-sm font-semibold text-ink mb-2">{formatMathText(result.questionMetacognitive.enonce)}</p>
                <textarea
                  value={metaReponse}
                  onChange={(e) => setMetaReponse(e.target.value)}
                  placeholder="Écris ta réponse ici…"
                  className="w-full min-h-[80px] rounded-[14px] border-2 border-line p-3 font-sans text-sm focus:outline-none focus:border-primary"
                />
                <div className="mt-2">
                  <Button variant="ghost" onClick={() => metaMutation.mutate()} disabled={!metaReponse.trim()}>
                    Envoyer
                  </Button>
                </div>
              </Card>
            )}

            {result && (
              <div className="mt-4">
                <Button onClick={handleContinue} disabled={isTransitioning}>
                  Continuer →
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
