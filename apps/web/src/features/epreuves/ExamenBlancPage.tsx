import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { AppHeader } from "../../components/AppHeader";
import { Button, Card, ClavierMaths, ErrorState, LoadingState, MathText } from "../../design-system";
import { RapportView, formatPoints, sousTitreEpreuve, titreEpreuve, type Passage, type Rapport } from "./rapport";
import { BoutonPhotos, ConseilsPhoto, envoyerPhotos } from "./photos";

/** Pages de copie photographiables au total (même plafond que l'API). */
const MAX_PAGES = 8;

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
  const [restantPhotosMs, setRestantPhotosMs] = useState<number | null>(null);
  const [erreurPhotos, setErreurPhotos] = useState<string | null>(null);
  const zoneReponse = useRef<HTMLTextAreaElement>(null);

  const textesRef = useRef<Record<string, string>>({});
  const decalageHorlogeRef = useRef(0);
  /** Heure limite (ms, horloge serveur) : plus aucun enregistrement de brouillon après. */
  const limiteRef = useRef<number | null>(null);
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
      if (limiteRef.current !== null && Date.now() + decalageHorlogeRef.current > limiteRef.current) return;
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
    limiteRef.current = limite;
    const finPhotos = passage.examen.finPhotosAt ? new Date(passage.examen.finPhotosAt).getTime() : null;
    const tick = () => {
      const maintenant = Date.now() + decalageHorlogeRef.current;
      const restant = limite - maintenant;
      setRestantMs(restant);
      // Copie papier : à l'heure limite on pose le stylo, puis on a le délai photo pour rendre.
      if (finPhotos !== null) {
        setRestantPhotosMs(finPhotos - maintenant);
        if (finPhotos - maintenant <= 0) void lancerRemise();
      } else if (restant <= 0) {
        void lancerRemise();
      }
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

  const majPassage = (maj: Partial<NonNullable<Passage["examen"]>>) =>
    queryClient.setQueryData<Passage>(queryKey, (p) => (p && p.examen ? { ...p, examen: { ...p.examen, ...maj } } : p));

  const choisirPapier = useMutation({
    mutationFn: (actif: boolean) => api.put<Passage>(`/api/eleve/passages/${passageId}/copie-papier`, { actif }),
    onSuccess: (p) => p.examen && majPassage({ copiePapier: p.examen.copiePapier, finPhotosAt: p.examen.finPhotosAt }),
  });
  const envoyerPages = useMutation({
    mutationFn: (photos: Blob[]) =>
      envoyerPhotos<{ transcriptions: Record<string, string>; nbPages: number; remarque: string | null }>(
        `/api/eleve/passages/${passageId}/photos`,
        photos
      ),
    onSuccess: (r) => {
      setErreurPhotos(r.remarque);
      majPassage({ transcriptions: r.transcriptions, nbPages: r.nbPages });
    },
    onError: (err) => setErreurPhotos(err instanceof ApiError ? err.message : "Les photos n'ont pas pu être envoyées. Réessaie."),
  });
  const effacerPages = useMutation({
    mutationFn: () => api.delete(`/api/eleve/passages/${passageId}/photos`),
    onSuccess: () => {
      setErreurPhotos(null);
      majPassage({ transcriptions: {}, nbPages: 0 });
    },
  });

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
    const lues = passage.examen?.transcriptions ?? {};
    const vides = passage.questions.filter((q) => !(textesRef.current[q.cle] ?? "").trim() && !lues[q.cle]?.trim()).length;
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
  const examen = passage?.examen;
  const papier = !!examen?.copiePapier;
  const tempsEcoule = restantMs !== null && restantMs <= 0;
  const phasePhotos = papier && tempsEcoule;
  const alerte = restantMs !== null && restantMs <= ALERTE_TEMPS_MS;
  const lues = examen?.transcriptions ?? {};
  const nbRedigees = passage
    ? passage.questions.filter((q) => (textes[q.cle] ?? "").trim() || lues[q.cle]?.trim()).length
    : 0;

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader
        title={
          phasePhotos && restantPhotosMs !== null
            ? `📷 ${formatChrono(restantPhotosMs)}`
            : restantMs !== null
              ? `⏱ ${formatChrono(restantMs)}`
              : titre
        }
        subtitle={passage ? `${titre} · ${sousTitreEpreuve(passage, "Examen blanc")}` : "Examen blanc"}
        variant={alerte ? "alert" : "deep"}
      />
      <div className="max-w-lg mx-auto p-5 space-y-4">
        {isLoading && <LoadingState label="Chargement de l'examen…" />}
        {!isLoading && error && <ErrorState message="Impossible de charger cet examen." onRetry={() => refetch()} />}
        {erreurRemise && <ErrorState message={erreurRemise} onRetry={() => void lancerRemise()} />}

        {passage && question && (
          <>
            {phasePhotos && (
              <Card className="bg-accent-tint border-accent">
                <p className="font-display font-bold text-base text-ink mb-1">Temps écoulé : pose ton stylo ✋</p>
                <p className="text-sm text-ink">
                  Il te reste {restantPhotosMs !== null ? formatChrono(restantPhotosMs) : "quelques minutes"} pour photographier
                  ta copie, puis rends-la. Elle sera rendue automatiquement à la fin de ce délai.
                </p>
              </Card>
            )}

            {!tempsEcoule && (
              <label className="flex items-start gap-3 bg-surface border border-line rounded p-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 w-5 h-5 accent-[var(--primary)]"
                  checked={papier}
                  disabled={choisirPapier.isPending}
                  onChange={(e) => choisirPapier.mutate(e.target.checked)}
                />
                <span className="text-sm text-ink">
                  <strong>✍️ Je rédige sur papier</strong>
                  <span className="block text-ink-soft text-xs mt-0.5">
                    Comme à l'examen : tu photographies ta copie à la fin, tu auras 10 minutes de plus pour le faire. Tu peux
                    aussi mélanger papier et saisie au clavier.
                  </span>
                </span>
              </label>
            )}

            {papier && (
              <Card>
                <div className="font-display font-bold text-base text-ink mb-1">📷 Ma copie papier</div>
                <p className="text-sm text-ink-soft mb-2">
                  {examen?.nbPages ? `${examen.nbPages} page(s) envoyée(s).` : "Aucune page envoyée pour l'instant."} Chaque
                  page est lue tout de suite : vérifie ci-dessous ce qui a été compris.
                </p>
                <ConseilsPhoto />
                <div className="mt-2 space-y-2">
                  <BoutonPhotos
                    libelle={`Photographier ${examen?.nbPages ? "d'autres pages" : "ma copie"} (${examen?.nbPages ?? 0}/${MAX_PAGES})`}
                    max={Math.max(1, Math.min(6, MAX_PAGES - (examen?.nbPages ?? 0)))}
                    enCours={envoyerPages.isPending}
                    variant={phasePhotos ? "primary" : "ghost"}
                    onPhotos={(photos) => envoyerPages.mutate(photos)}
                  />
                  {!!examen?.nbPages && (
                    <button
                      type="button"
                      className="text-xs font-mono text-alert underline"
                      disabled={effacerPages.isPending}
                      onClick={() => {
                        if (window.confirm("Effacer toutes les pages envoyées pour les reprendre ?")) effacerPages.mutate();
                      }}
                    >
                      Recommencer les photos
                    </button>
                  )}
                </div>
                {erreurPhotos && <p className="text-sm text-alert mt-2">{erreurPhotos}</p>}
                {Object.keys(lues).length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {passage.questions.map((q) => (
                      <li key={q.cle} className="text-xs">
                        <span className="font-mono text-ink-soft">Q{q.numero} · </span>
                        {lues[q.cle] ? (
                          <span className="text-primary-deep">lue ✓</span>
                        ) : (
                          <span className="text-ink-soft">rien de lu pour l'instant</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

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
              {!tempsEcoule && (
                <ClavierMaths
                  zone={zoneReponse}
                  onInsertion={(valeur) => {
                    textesRef.current = { ...textesRef.current, [question.cle]: valeur };
                    setTextes(textesRef.current);
                  }}
                />
              )}
              <textarea
                ref={zoneReponse}
                value={textes[question.cle] ?? ""}
                readOnly={tempsEcoule}
                onChange={(e) => {
                  textesRef.current = { ...textesRef.current, [question.cle]: e.target.value };
                  setTextes(textesRef.current);
                }}
                placeholder={
                  papier
                    ? "Facultatif : tu rédiges sur papier. Tu peux compléter ici au clavier."
                    : "Rédige ta réponse comme sur ta copie : démarche, calculs, résultat."
                }
                className={`w-full ${papier ? "min-h-[100px]" : "min-h-[220px]"} rounded-[14px] border-2 border-line p-3 font-sans text-sm focus:outline-none focus:border-primary read-only:bg-bg`}
              />
              {lues[question.cle] && (
                <div className="bg-bg rounded-[12px] p-3 mt-3">
                  <div className="text-[11px] font-mono uppercase text-ink-soft mb-1">📷 Lu sur ta copie pour cette question</div>
                  <div className="text-sm text-ink whitespace-pre-wrap">
                    <MathText text={lues[question.cle]!} />
                  </div>
                </div>
              )}
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
