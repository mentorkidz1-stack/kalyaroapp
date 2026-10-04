import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { AppHeader } from "../../components/AppHeader";
import { Button, Card, ChoiceButton, LoadingState, EmptyState, ErrorState, MathText } from "../../design-system";
import { useQcmNext, useSubmitQcm } from "../qcm/useQcm";
import {
  CorrectionView,
  RapportView,
  formatPoints,
  sousTitreEpreuve,
  titreEpreuve,
  type Correction,
  type Passage,
  type Rapport,
} from "./rapport";

interface NotionRef {
  id: string;
  nom: string;
  chapitreId: string;
}
interface ResultatQuestion extends Correction {
  cle: string;
  ratee: boolean;
  diagnostic: { diagnosticId: string; notionASonder: NotionRef } | null;
}
interface AdvanceDiagnosticResult {
  resolu: false;
  notionATravailler?: NotionRef;
  notionASonder?: NotionRef;
  chemin: { notionId: string; notionNom: string; resultat: "fail" | "success" }[];
}

type Diagnostic =
  | { type: "propose"; diagnosticId: string; notion: NotionRef }
  | { type: "sondage"; diagnosticId: string; notion: NotionRef }
  | { type: "trouve"; notion: NotionRef };

/** Passage d'une épreuve question par question, avec correction sur barème et rapport final. */
export function EpreuveSessionPage() {
  const { passageId } = useParams<{ passageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryKey = ["passage", passageId];

  const { data: passage, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => api.get<Passage>(`/api/eleve/passages/${passageId}`),
    enabled: !!passageId,
    refetchOnWindowFocus: false,
  });

  const [index, setIndex] = useState<number | null>(null);
  const [reponse, setReponse] = useState("");
  const [diagnostics, setDiagnostics] = useState<Record<string, Diagnostic>>({});
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reprise : on se place sur la première question sans réponse.
  useEffect(() => {
    if (!passage || index !== null) return;
    const premiere = passage.questions.findIndex((q) => !passage.reponses[q.cle]);
    setIndex(premiere === -1 ? passage.questions.length - 1 : premiere);
  }, [passage, index]);

  const rapportQuery = useQuery({
    queryKey: ["passage-rapport", passageId],
    queryFn: () => api.get<Rapport>(`/api/eleve/passages/${passageId}/rapport`),
    enabled: !!passage?.termine && !rapport,
  });

  const repondre = useMutation({
    mutationFn: (cle: string) =>
      api.post<ResultatQuestion>(`/api/eleve/passages/${passageId}/questions/${cle}/repondre`, { reponseDonnee: reponse }),
    onSuccess: (r) => {
      setSubmitError(null);
      setReponse("");
      if (r.diagnostic) {
        const { diagnosticId, notionASonder } = r.diagnostic;
        setDiagnostics((d) => ({ ...d, [r.cle]: { type: "propose", diagnosticId, notion: notionASonder } }));
      }
      queryClient.setQueryData<Passage>(queryKey, (p) =>
        p ? { ...p, reponses: { ...p.reponses, [r.cle]: { ...r, reponseDonnee: reponse } } } : p
      );
    },
    onError: (err) =>
      setSubmitError(
        err instanceof ApiError && err.status === 502
          ? "La correction automatique est momentanément indisponible. Ta réponse n'a pas été perdue : renvoie-la dans un instant."
          : err instanceof ApiError
            ? err.message
            : "Ta réponse n'a pas pu être envoyée. Réessaie."
      ),
  });

  const terminer = useMutation({
    mutationFn: () => api.post<Rapport>(`/api/eleve/passages/${passageId}/terminer`),
    onSuccess: (r) => {
      setRapport(r);
      queryClient.invalidateQueries({ queryKey: ["epreuves-eleve"] });
      window.scrollTo({ top: 0 });
    },
  });

  const recommencer = useMutation({
    mutationFn: () => api.post<Passage>(`/api/eleve/epreuves/${passage!.epreuve.id}/passages`),
    onSuccess: (p) => {
      setRapport(null);
      setIndex(null);
      setDiagnostics({});
      queryClient.setQueryData(["passage", p.passageId], p);
      navigate(`/epreuves/passages/${p.passageId}`, { replace: true });
    },
  });

  // Un examen blanc a son propre écran (chronomètre, pas de correction avant la fin).
  useEffect(() => {
    if (passage?.mode === "EXAMEN_BLANC") navigate(`/epreuves/examen/${passage.passageId}`, { replace: true });
  }, [passage, navigate]);

  const titre = passage ? titreEpreuve(passage) : "Épreuve";
  const sousTitre = passage ? sousTitreEpreuve(passage, "Entraînement") : "Kalyaro";

  const rapportAffiche = rapport ?? rapportQuery.data ?? null;
  if (passage && rapportAffiche) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader title={titre} subtitle={sousTitre} onBack={() => navigate("/epreuves")} />
        <div className="max-w-lg mx-auto p-5">
          <RapportView
            rapport={rapportAffiche}
            passage={passage}
            onRetour={() => navigate("/epreuves")}
            onRecommencer={() => recommencer.mutate()}
            recommencementEnCours={recommencer.isPending}
          />
        </div>
      </div>
    );
  }

  const question = passage && index !== null ? passage.questions[index] : undefined;
  const correction = question ? passage?.reponses[question.cle] : undefined;
  const nbRepondues = passage ? passage.questions.filter((q) => passage.reponses[q.cle]).length : 0;
  const toutRepondu = !!passage && nbRepondues === passage.questions.length;
  const diagnostic = question ? diagnostics[question.cle] : undefined;

  function terminerAvecConfirmation() {
    if (!passage) return;
    const restantes = passage.questions.length - nbRepondues;
    if (
      restantes > 0 &&
      !window.confirm(`Il reste ${restantes} question(s) sans réponse : elles compteront 0. Terminer quand même ?`)
    )
      return;
    terminer.mutate();
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader title={titre} subtitle={sousTitre} onBack={() => navigate("/epreuves")} />
      <div className="max-w-lg mx-auto p-5 space-y-4">
        {(isLoading || rapportQuery.isLoading) && <LoadingState label="Chargement de l'épreuve…" />}
        {!isLoading && error && <ErrorState message="Impossible de charger cette épreuve." onRetry={() => refetch()} />}

        {passage && question && (
          <>
            {passage.questions.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Questions">
                {passage.questions.map((q, i) => {
                  const r = passage.reponses[q.cle];
                  const couleur = !r
                    ? "border-line text-ink-soft"
                    : r.pointsObtenus >= r.pointsMax / 2
                      ? "border-primary bg-primary-tint text-primary-deep"
                      : "border-accent bg-accent-tint text-[#8A5A0E]";
                  return (
                    <button
                      key={q.cle}
                      type="button"
                      role="tab"
                      aria-selected={i === index}
                      onClick={() => {
                        setIndex(i);
                        setSubmitError(null);
                      }}
                      className={`min-w-[44px] px-2 py-1.5 rounded-[10px] border-2 text-xs font-bold ${couleur} ${
                        i === index ? "ring-2 ring-primary ring-offset-1" : ""
                      }`}
                    >
                      {q.numero}
                    </button>
                  );
                })}
              </div>
            )}

            {passage.epreuve.decoupee && (
              <details className="bg-surface border border-line rounded p-3">
                <summary className="text-sm font-bold text-ink cursor-pointer">Sujet complet</summary>
                <div className="text-sm text-ink mt-2 whitespace-pre-wrap">
                  <MathText text={passage.epreuve.enonce} />
                </div>
              </details>
            )}

            <Card>
              <div className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-2">
                Question {question.numero} · {formatPoints(question.points)} pt{question.points > 1 ? "s" : ""}
                {question.notionNom ? ` · ${question.notionNom}` : ""}
              </div>
              <div className="font-display text-[17px] leading-snug text-ink mb-4 whitespace-pre-wrap">
                <MathText text={question.enonce} />
              </div>

              {!correction && (
                <>
                  <textarea
                    value={reponse}
                    onChange={(e) => setReponse(e.target.value)}
                    placeholder="Rédige ta réponse comme sur ta copie : démarche, calculs, résultat."
                    className="w-full min-h-[160px] rounded-[14px] border-2 border-line p-3 font-sans text-sm focus:outline-none focus:border-primary mb-3"
                  />
                  <Button onClick={() => repondre.mutate(question.cle)} disabled={!reponse.trim() || repondre.isPending}>
                    {repondre.isPending ? "Correction en cours…" : "Valider ma réponse"}
                  </Button>
                  {submitError && (
                    <div className="mt-3">
                      <ErrorState message={submitError} />
                    </div>
                  )}
                </>
              )}

              {correction && <CorrectionView correction={correction} />}
            </Card>

            {correction && diagnostic?.type === "propose" && (
              <Card className="bg-accent-tint border-accent">
                <p className="text-sm text-ink mb-3">
                  Tu as perdu des points sur cette question. Une ou deux questions rapides peuvent révéler le prérequis qui
                  te bloque vraiment.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => setDiagnostics((d) => ({ ...d, [question.cle]: { ...diagnostic, type: "sondage" } }))}
                >
                  Trouver l'origine de l'erreur
                </Button>
              </Card>
            )}
            {correction && diagnostic?.type === "sondage" && (
              <SondagePhase
                key={diagnostic.notion.id}
                diagnosticId={diagnostic.diagnosticId}
                notion={diagnostic.notion}
                onAdvance={(result) => {
                  const { notionATravailler, notionASonder } = result;
                  if (notionATravailler) {
                    setDiagnostics((d) => ({ ...d, [question.cle]: { type: "trouve", notion: notionATravailler } }));
                  } else if (notionASonder) {
                    setDiagnostics((d) => ({
                      ...d,
                      [question.cle]: { type: "sondage", diagnosticId: diagnostic.diagnosticId, notion: notionASonder },
                    }));
                  }
                }}
              />
            )}
            {correction && diagnostic?.type === "trouve" && (
              <Card className="text-center py-6">
                <p className="font-display font-bold text-base text-ink mb-2">Origine trouvée : {diagnostic.notion.nom}</p>
                <p className="text-sm text-ink-soft mb-4">
                  C'est cette notion qui te fait perdre des points. Tu peux la travailler maintenant ou finir l'épreuve d'abord.
                </p>
                <Button
                  variant="ghost"
                  onClick={() =>
                    navigate(`/parcours/${diagnostic.notion.chapitreId}/qcm/${diagnostic.notion.id}`, {
                      state: { returnToEpreuve: { passageId } },
                    })
                  }
                >
                  Travailler cette notion
                </Button>
              </Card>
            )}

            <div className="flex flex-col gap-2">
              {correction && index !== null && index < passage.questions.length - 1 && (
                <Button onClick={() => setIndex(index + 1)}>Question suivante →</Button>
              )}
              {toutRepondu ? (
                <Button onClick={() => terminer.mutate()} disabled={terminer.isPending}>
                  {terminer.isPending ? "Calcul de ta note…" : "Voir ma note"}
                </Button>
              ) : (
                <Button variant="ghost" onClick={terminerAvecConfirmation} disabled={terminer.isPending}>
                  Terminer l'épreuve
                </Button>
              )}
              <p className="text-xs text-ink-soft text-center">
                {nbRepondues} / {passage.questions.length} question(s) corrigée(s) · noté sur{" "}
                {formatPoints(passage.epreuve.bareme)}
              </p>
            </div>
          </>
        )}

        {passage && passage.questions.length === 0 && <EmptyState icon="📝" message="Cette épreuve n'a pas de question." />}
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
  // Voir QcmSessionPage.tsx : isPending a un rendu de retard sur un double clic rapide ; un ref
  // positionné dès le premier appel ferme la course quel que soit le moment du rendu.
  const submittingRef = useRef(false);

  const advance = useMutation({
    mutationFn: (id: string) =>
      api.post<AdvanceDiagnosticResult>(`/api/eleve/diagnostic/${diagnosticId}/avancer`, { tentativeId: id }),
    onSuccess: (data) => onAdvance(data),
    onError: () => setPhaseError("Impossible de continuer. Réessaie."),
  });

  function handleChoice(choix: string) {
    if (correcte !== null || !question || submittingRef.current) return;
    submittingRef.current = true;
    setPhaseError(null);
    setSelected(choix);
    submitQcm.mutate(
      { attemptToken: question.attemptToken, reponseDonnee: choix },
      {
        onSuccess: (result) => {
          submittingRef.current = false;
          setCorrecte(result.correcte);
          setTentativeId(result.tentativeId);
        },
        onError: () => {
          submittingRef.current = false;
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
      {!isLoading && error && <ErrorState message="Impossible de charger cette question." onRetry={() => refetch()} />}
      {!isLoading && !error && !question && (
        <EmptyState icon="❓" message="Aucune question disponible pour ce prérequis pour l'instant." />
      )}
      {question && (
        <>
          <h3 className="font-display text-[17px] leading-snug text-ink mb-4">
            <MathText text={question.enonce} />
          </h3>
          {question.choix.map((choix) => {
            const state = correcte !== null && selected === choix ? (correcte ? "correct" : "wrong") : "default";
            return (
              <ChoiceButton
                key={choix}
                state={state}
                disabled={correcte !== null || submitQcm.isPending}
                onClick={() => handleChoice(choix)}
              >
                <MathText text={choix} />
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
