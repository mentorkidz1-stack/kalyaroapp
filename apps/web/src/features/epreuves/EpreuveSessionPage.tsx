import { useState } from "react";
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
import { useQcmNext, useSubmitQcm } from "../qcm/useQcm";

interface NotionRef {
  id: string;
  nom: string;
  chapitreId: string;
}
interface SubmitEpreuveResult {
  valide: boolean;
  explication: string;
  diagnostic: { diagnosticId: string; notionASonder: NotionRef } | null;
}
interface AdvanceDiagnosticResult {
  resolu: false;
  notionATravailler?: NotionRef;
  notionASonder?: NotionRef;
  chemin: { notionId: string; notionNom: string; resultat: "fail" | "success" }[];
}

type Phase =
  | { type: "epreuve" }
  | { type: "sondage"; diagnosticId: string; notion: NotionRef }
  | { type: "echec-simple"; explication: string }
  | { type: "succes" }
  | { type: "redirection"; notion: NotionRef };

export function EpreuveSessionPage() {
  const { epreuveId } = useParams<{ epreuveId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const enonce = (location.state as { enonce?: string } | null)?.enonce;

  const [phase, setPhase] = useState<Phase>({ type: "epreuve" });
  const [reponse, setReponse] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitEpreuve = useMutation({
    mutationFn: () =>
      api.post<SubmitEpreuveResult>(`/api/eleve/epreuves/${epreuveId}/soumettre`, { reponseDonnee: reponse }),
    onSuccess: (data) => {
      setSubmitError(null);
      if (data.valide) {
        setPhase({ type: "succes" });
      } else if (data.diagnostic) {
        setPhase({
          type: "sondage",
          diagnosticId: data.diagnostic.diagnosticId,
          notion: data.diagnostic.notionASonder,
        });
      } else {
        setPhase({ type: "echec-simple", explication: data.explication });
      }
    },
    onError: () => setSubmitError("Ta réponse n'a pas pu être envoyée. Réessaie."),
  });

  if (!epreuveId) return null;

  if (!enonce) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader title="Épreuve" subtitle="Kalyaro" onBack={() => navigate("/epreuves")} />
        <div className="max-w-lg mx-auto p-5">
          <Card className="text-center py-8">
            <p className="text-sm text-ink-soft mb-4">Cette page s'ouvre depuis la liste des épreuves.</p>
            <Button onClick={() => navigate("/epreuves")}>Retour aux épreuves</Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader title="Épreuve" subtitle="Kalyaro" />
      <div className="max-w-lg mx-auto p-5">
        {phase.type === "epreuve" && (
          <Card>
            <h3 className="font-display text-[19px] leading-snug text-ink mb-4">{formatMathText(enonce)}</h3>
            <textarea
              value={reponse}
              onChange={(e) => setReponse(e.target.value)}
              placeholder="Écris ta réponse ici…"
              className="w-full min-h-[140px] rounded-[14px] border-2 border-line p-3 font-sans text-sm focus:outline-none focus:border-primary mb-3"
            />
            <Button onClick={() => submitEpreuve.mutate()} disabled={!reponse.trim() || submitEpreuve.isPending}>
              {submitEpreuve.isPending ? "Évaluation…" : "Soumettre"}
            </Button>
            {submitError && (
              <div className="mt-3">
                <ErrorState message={submitError} />
              </div>
            )}
          </Card>
        )}

        {phase.type === "succes" && (
          <MasteryCelebration title="Épreuve réussie !" message="Bien joué, continue comme ça.">
            <Button onClick={() => navigate("/epreuves")}>Retour aux épreuves</Button>
          </MasteryCelebration>
        )}

        {phase.type === "echec-simple" && (
          <Card>
            <FeedbackBlock variant="warn">{formatMathText(phase.explication)}</FeedbackBlock>
            <div className="mt-4">
              <Button variant="ghost" onClick={() => navigate("/epreuves")}>
                Retour aux épreuves
              </Button>
            </div>
          </Card>
        )}

        {phase.type === "sondage" && (
          <SondagePhase
            key={phase.notion.id}
            diagnosticId={phase.diagnosticId}
            notion={phase.notion}
            onAdvance={(result) => {
              if (result.notionATravailler) {
                setPhase({ type: "redirection", notion: result.notionATravailler });
              } else if (result.notionASonder) {
                setPhase({ type: "sondage", diagnosticId: phase.diagnosticId, notion: result.notionASonder });
              }
            }}
          />
        )}

        {phase.type === "redirection" && (
          <Card className="text-center py-8">
            <p className="font-display font-bold text-lg text-ink mb-2">Il te manque une notion avant de continuer</p>
            <p className="text-sm text-ink-soft mb-6">
              On a trouvé la vraie source du problème : <strong>{phase.notion.nom}</strong>. Travaille-la d'abord.
            </p>
            <Button
              onClick={() =>
                navigate(`/parcours/${phase.notion.chapitreId}/qcm/${phase.notion.id}`, {
                  state: { returnToEpreuve: { epreuveId, enonce } },
                })
              }
            >
              Travailler cette notion
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

function SondagePhase({
  diagnosticId,
  notion,
  onAdvance,
}: {
  diagnosticId: string;
  notion: NotionRef;
  onAdvance: (result: AdvanceDiagnosticResult) => void;
}) {
  const { data: question, isLoading, error, refetch } = useQcmNext(notion.id);
  const submitQcm = useSubmitQcm();
  const [selected, setSelected] = useState<string | null>(null);
  const [correcte, setCorrecte] = useState<boolean | null>(null);
  const [tentativeId, setTentativeId] = useState<string | null>(null);
  const [phaseError, setPhaseError] = useState<string | null>(null);

  const advance = useMutation({
    mutationFn: (tentativeId: string) =>
      api.post<AdvanceDiagnosticResult>(`/api/eleve/diagnostic/${diagnosticId}/avancer`, { tentativeId }),
    onSuccess: (data) => onAdvance(data),
    onError: () => setPhaseError("Impossible de continuer. Réessaie."),
  });

  function handleChoice(choix: string) {
    if (correcte !== null || !question) return;
    setPhaseError(null);
    setSelected(choix);
    submitQcm.mutate(
      { attemptToken: question.attemptToken, reponseDonnee: choix },
      {
        onSuccess: (result) => {
          setCorrecte(result.correcte);
          setTentativeId(result.tentativeId);
        },
        onError: () => {
          setSelected(null);
          setPhaseError("Ta réponse n'a pas pu être envoyée. Réessaie.");
        },
      }
    );
  }

  return (
    <Card>
      <div className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-2">
        Vérifions ce prérequis : {notion.nom}
      </div>
      {isLoading && <LoadingState label="Chargement de la question…" />}
      {!isLoading && error && (
        <ErrorState message="Impossible de charger cette question." onRetry={() => refetch()} />
      )}
      {!isLoading && !error && !question && (
        <EmptyState icon="❓" message="Aucune question disponible pour ce prérequis pour l'instant." />
      )}
      {question && (
        <>
          <h3 className="font-display text-[17px] leading-snug text-ink mb-4">{formatMathText(question.enonce)}</h3>
          {question.choix.map((choix) => {
            const state = correcte !== null && selected === choix ? (correcte ? "correct" : "wrong") : "default";
            return (
              <ChoiceButton
                key={choix}
                state={state}
                disabled={correcte !== null}
                onClick={() => handleChoice(choix)}
              >
                {formatMathText(choix)}
              </ChoiceButton>
            );
          })}
          {phaseError && (
            <div className="mt-3">
              <ErrorState message={phaseError} />
            </div>
          )}
          {tentativeId !== null && (
            <div className="mt-4">
              <Button onClick={() => advance.mutate(tentativeId)} disabled={advance.isPending}>
                {advance.isPending ? "Analyse…" : "Continuer →"}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
