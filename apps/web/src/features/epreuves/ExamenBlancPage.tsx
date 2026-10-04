import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { AppHeader } from "../../components/AppHeader";
import { Button, Card, ErrorState, LoadingState, MathText } from "../../design-system";
import { RapportView, formatPoints, sousTitreEpreuve, titreEpreuve, type Passage, type Rapport } from "./rapport";

/** Enregistrement après une pause de frappe. */
const DELAI_ENREGISTREMENT_MS = 1500;
/** Enregistrement périodique (temps passé), même sans frappe. */
const PERIODE_ENREGISTREMENT_MS = 30_000;
/** En dessous, le chronomètre passe en alerte. */
const ALERTE_TEMPS_MS = 5 * 60_000;

type EtatEnregistrement = "enregistre" | "en_cours" | "hors_ligne";

function formatChrono(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const deux = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${deux(m)}:${deux(r)}` : `${deux(m)}:${deux(r)}`;
}

/**
 * Examen blanc en conditions réelles : chronomètre, aucune correction ni indice avant la fin,
 * enregistrement automatique, remise automatique à l'expiration, puis rapport détaillé.
 */
export function ExamenBlancPage() {
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

  const [textes, setTextes] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [restantMs, setRestantMs] = useState<number | null>(null);
  const [etat, setEtat] = useState<EtatEnregistrement>("enregistre");
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [erreurRemise, setErreurRemise] = useState<string | null>(null);

  const textesRef = useRef<Record<string, string>>({});
  const decalageHorlogeRef = useRef(0);
  const initialiseRef = useRef(false);
  const remiseLanceeRef = useRef(false);
  // Temps passé par question pas encore envoyé au serveur (secondes), et début du chrono local.
  const tempsNonEnvoyeRef = useRef<Record<string, number>>({});
  const debutVisibleRef = useRef<number | null>(null);
  const cleCouranteRef = useRef<string | null>(null);

  const enCours = !!passage && passage.mode === "EXAMEN_BLANC" && !passage.termine && !rapport;

  useEffect(() => {
    if (!passage?.examen || initialiseRef.current) return;
    initialiseRef.current = true;
    textesRef.current = { ...passage.examen.brouillons };
    setTextes(textesRef.current);
    decalageHorlogeRef.current = new Date(passage.examen.serverNow).getTime() - Date.now();
    debutVisibleRef.current = Date.now();
  }, [passage]);

  useEffect(() => {
    if (passage && passage.mode !== "EXAMEN_BLANC") navigate(`/epreuves/passages/${passage.passageId}`, { replace: true });
  }, [passage, navigate]);

  const cle = passage?.questions[index]?.cle ?? null;
  useEffect(() => {
    cleCouranteRef.current = cle;
  }, [cle]);

  /** Ajoute au compteur de la question affichée le temps écoulé depuis le dernier relevé. */
  const releverTemps = useCallback(() => {
    const c = cleCouranteRef.current;
    if (!c || debutVisibleRef.current === null) return;
    const maintenant = Date.now();
    tempsNonEnvoyeRef.current[c] = (tempsNonEnvoyeRef.current[c] ?? 0) + (maintenant - debutVisibleRef.current) / 1000;
    debutVisibleRef.current = maintenant;
  }, []);

  const rapportQuery = useQuery({
    queryKey: ["passage-rapport", passageId],
    queryFn: () => api.get<Rapport>(`/api/eleve/passages/${passageId}/rapport`),
    enabled: !!passage?.termine && !rapport,
  });

  const rendre = useMutation({
    mutationFn: () => api.post<Rapport>(`/api/eleve/passages/${passageId}/rendre`, { brouillons: textesRef.current }),
    onSuccess: async (r) => {
      setErreurRemise(null);
      setRapport(r);
      queryClient.invalidateQueries({ queryKey: ["epreuves-eleve"] });
      queryClient.invalidateQueries({ queryKey: ["revisions-dues"] });
      await refetch(); // récupère les corrections détaillées, visibles maintenant
      window.scrollTo({ top: 0 });
    },
    onError: (err) => {
      remiseLanceeRef.current = false;
      setErreurRemise(err instanceof ApiError ? err.message : "Ta copie n'a pas pu être envoyée. Vérifie ta connexion et réessaie.");
    },
  });
  const rendreMutate = rendre.mutate;

  const enregistrer = useCallback(
    async (c: string) => {
      if (!passageId) return;
      releverTemps();
      // Secondes entières seulement : le reste (fraction de seconde) est gardé pour l'envoi
      // suivant, sinon des enregistrements rapprochés arrondis à 0 feraient perdre du temps.
      const accumule = tempsNonEnvoyeRef.current[c] ?? 0;
      const delta = Math.floor(accumule);
      tempsNonEnvoyeRef.current[c] = accumule - delta;
      setEtat("en_cours");
      try {
        await api.put(`/api/eleve/passages/${passageId}/brouillons/${c}`, {
          texte: textesRef.current[c] ?? "",
          deltaSecondes: delta,
        });
        setEtat("enregistre");
      } catch (err) {
        tempsNonEnvoyeRef.current[c] = (tempsNonEnvoyeRef.current[c] ?? 0) + delta;
        if (err instanceof ApiError && err.status === 409) {
          // Le serveur a déjà clos la copie (heure limite) : on affiche le rapport.
          await refetch();
          return;
        }
        setEtat("hors_ligne");
      }
    },
    [passageId, releverTemps, refetch]
  );

  const lancerRemise = useCallback(async () => {
    if (remiseLanceeRef.current) return;
    remiseLanceeRef.current = true;
    if (cleCouranteRef.current) await enregistrer(cleCouranteRef.current);
    rendreMutate();
  }, [enregistrer, rendreMutate]);

  // Chronomètre (calé sur l'heure du serveur) et remise automatique à zéro.
  useEffect(() => {
    if (!enCours || !passage?.examen) return;
    const limite = new Date(passage.examen.dateLimiteAt).getTime();
    const tick = () => {
      const restant = limite - (Date.now() + decalageHorlogeRef.current);
      setRestantMs(restant);
      if (restant <= 0) void lancerRemise();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enCours, passage, lancerRemise]);

  // Enregistrement après une pause de frappe sur la question affichée.
  const texteCourant = cle ? textes[cle] : undefined;
  useEffect(() => {
    if (!enCours || !cle || !initialiseRef.current) return;
    const id = setTimeout(() => void enregistrer(cle), DELAI_ENREGISTREMENT_MS);
    return () => clearTimeout(id);
  }, [texteCourant, cle, enCours, enregistrer]);

  // Enregistrement périodique (temps passé), et quand la page passe en arrière-plan.
  useEffect(() => {
    if (!enCours) return;
    const id = setInterval(() => {
      if (cleCouranteRef.current) void enregistrer(cleCouranteRef.current);
    }, PERIODE_ENREGISTREMENT_MS);
    const surVisibilite = () => {
      if (document.visibilityState === "hidden") {
        releverTemps();
        debutVisibleRef.current = null;
        if (cleCouranteRef.current) void enregistrer(cleCouranteRef.current);
      } else {
        debutVisibleRef.current = Date.now();
      }
    };
    const avantDepart = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("beforeunload", avantDepart);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("beforeunload", avantDepart);
    };
  }, [enCours, enregistrer, releverTemps]);

  const recommencer = useMutation({
    mutationFn: () => api.post<Passage>(`/api/eleve/epreuves/${passage!.epreuve.id}/passages`, { mode: "EXAMEN_BLANC" }),
    onSuccess: (p) => {
      initialiseRef.current = false;
      remiseLanceeRef.current = false;
      tempsNonEnvoyeRef.current = {};
      setRapport(null);
      setIndex(0);
      queryClient.setQueryData(["passage", p.passageId], p);
      navigate(`/epreuves/examen/${p.passageId}`, { replace: true });
    },
  });

  function changerDeQuestion(i: number) {
    if (!passage || i === index) return;
    if (cle) void enregistrer(cle);
    else releverTemps();
    setIndex(i);
  }

  function rendreAvecConfirmation() {
    if (!passage) return;
    const vides = passage.questions.filter((q) => !(textesRef.current[q.cle] ?? "").trim()).length;
    const message =
      vides > 0
        ? `Il reste ${vides} question(s) sans réponse : elles compteront 0. Rendre ta copie maintenant ?`
        : "Rendre ta copie maintenant ? Tu ne pourras plus la modifier.";
    if (window.confirm(message)) void lancerRemise();
  }

  const titre = passage ? titreEpreuve(passage) : "Examen blanc";
  const rapportAffiche = rapport ?? rapportQuery.data ?? null;

  if (passage && rapportAffiche) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader title={titre} subtitle="Examen blanc · résultat" onBack={() => navigate("/epreuves")} />
        <div className="max-w-lg mx-auto p-5">
          <RapportView
            rapport={rapportAffiche}
            passage={passage}
            onRetour={() => navigate("/epreuves")}
            onRecommencer={() => {
              if (window.confirm("Un nouvel examen blanc démarre tout de suite, chronomètre compris. Commencer ?")) {
                recommencer.mutate();
              }
            }}
            recommencementEnCours={recommencer.isPending}
            onRelancerCorrection={() => rendre.mutate()}
            relanceEnCours={rendre.isPending}
          />
        </div>
      </div>
    );
  }

  if (rendre.isPending || remiseLanceeRef.current || (passage?.termine && rapportQuery.isLoading)) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader title={titre} subtitle="Examen blanc" />
        <div className="max-w-lg mx-auto p-5 space-y-4">
          <LoadingState label="Correction de ta copie… Cela peut prendre une minute." />
          {erreurRemise && <ErrorState message={erreurRemise} onRetry={() => void lancerRemise()} />}
        </div>
      </div>
    );
  }

  const question = passage?.questions[index];
  const alerte = restantMs !== null && restantMs <= ALERTE_TEMPS_MS;
  const nbRedigees = passage ? passage.questions.filter((q) => (textes[q.cle] ?? "").trim()).length : 0;

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader
        title={restantMs !== null ? `⏱ ${formatChrono(restantMs)}` : titre}
        subtitle={passage ? `${titre} · ${sousTitreEpreuve(passage, "Examen blanc")}` : "Examen blanc"}
        variant={alerte ? "alert" : "deep"}
      />
      <div className="max-w-lg mx-auto p-5 space-y-4">
        {isLoading && <LoadingState label="Chargement de l'examen…" />}
        {!isLoading && error && <ErrorState message="Impossible de charger cet examen." onRetry={() => refetch()} />}
        {erreurRemise && <ErrorState message={erreurRemise} onRetry={() => void lancerRemise()} />}

        {passage && question && (
          <>
            <div className="flex items-center justify-between text-xs font-mono text-ink-soft">
              <span>
                {nbRedigees} / {passage.questions.length} rédigée(s) · sur {formatPoints(passage.epreuve.bareme)}
              </span>
              <span className={etat === "hors_ligne" ? "text-alert" : ""}>
                {etat === "enregistre" ? "✓ enregistré" : etat === "en_cours" ? "enregistrement…" : "hors ligne — réessai automatique"}
              </span>
            </div>

            {passage.questions.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Questions">
                {passage.questions.map((q, i) => {
                  const redigee = (textes[q.cle] ?? "").trim().length > 0;
                  return (
                    <button
                      key={q.cle}
                      type="button"
                      role="tab"
                      aria-selected={i === index}
                      onClick={() => changerDeQuestion(i)}
                      className={`min-w-[44px] px-2 py-1.5 rounded-[10px] border-2 text-xs font-bold ${
                        redigee ? "border-primary bg-primary-tint text-primary-deep" : "border-line text-ink-soft"
                      } ${i === index ? "ring-2 ring-primary ring-offset-1" : ""}`}
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
              </div>
              <div className="font-display text-[17px] leading-snug text-ink mb-4 whitespace-pre-wrap">
                <MathText text={question.enonce} />
              </div>
              <textarea
                value={textes[question.cle] ?? ""}
                onChange={(e) => {
                  textesRef.current = { ...textesRef.current, [question.cle]: e.target.value };
                  setTextes(textesRef.current);
                }}
                placeholder="Rédige ta réponse comme sur ta copie : démarche, calculs, résultat."
                className="w-full min-h-[220px] rounded-[14px] border-2 border-line p-3 font-sans text-sm focus:outline-none focus:border-primary"
              />
            </Card>

            <div className="flex gap-2">
              <Button variant="ghost" disabled={index === 0} onClick={() => changerDeQuestion(index - 1)}>
                ← Précédente
              </Button>
              <Button variant="ghost" disabled={index === passage.questions.length - 1} onClick={() => changerDeQuestion(index + 1)}>
                Suivante →
              </Button>
            </div>
            <Button onClick={rendreAvecConfirmation}>Rendre ma copie</Button>
            <p className="text-xs text-ink-soft text-center">
              Conditions d'examen : pas de correction ni d'indice avant la fin. Ta copie est rendue automatiquement à la fin
              du temps.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
