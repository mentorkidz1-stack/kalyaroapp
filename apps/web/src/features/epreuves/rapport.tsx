import { useNavigate } from "react-router-dom";
import { Button, Card, FeedbackBlock, MathText } from "../../design-system";

// Types et vues partagés par l'entraînement (EpreuveSessionPage) et l'examen blanc
// (ExamenBlancPage) : correction d'une question et rapport final.

export interface Correction {
  pointsObtenus: number;
  pointsMax: number;
  explication: string;
  elementsReussis: string[];
  elementsManquants: string[];
  /** La réponse notée est la transcription d'une copie photographiée. */
  depuisPhoto?: boolean;
}

export interface QuestionPassage {
  cle: string;
  numero: string;
  enonce: string;
  points: number;
  notionNom: string | null;
  imageUrls: string[];
}

export interface Passage {
  passageId: string;
  mode: "ENTRAINEMENT" | "EXAMEN_BLANC";
  termine: boolean;
  epreuve: {
    id: string;
    enonce: string;
    decoupee: boolean;
    annee: number | null;
    session: string | null;
    examen: string | null;
    etablissementSource: string | null;
    bareme: number;
  };
  questions: QuestionPassage[];
  reponses: Record<string, Correction & { reponseDonnee: string }>;
  examen: {
    dateLimiteAt: string;
    dureeMinutes: number;
    serverNow: string;
    brouillons: Record<string, string>;
    copiePapier: boolean;
    finPhotosAt: string | null;
    nbPages: number;
    transcriptions: Record<string, string>;
  } | null;
}

type StatutTemps = "non_abordee" | "rapide" | "dans_le_temps" | "trop_long";

export interface Rapport {
  termine?: boolean;
  mode?: "ENTRAINEMENT" | "EXAMEN_BLANC";
  note: number;
  bareme: number;
  noteSur20: number;
  nbQuestions: number;
  nbRepondues: number;
  parQuestion: { cle: string; numero: string; points: number; pointsObtenus: number; repondue: boolean; ratee: boolean }[];
  parNotion: { notionId: string | null; notionNom: string; points: number; pointsObtenus: number; pointsPerdus: number }[];
  correctionIncomplete?: boolean;
  temps?: {
    dureeSecondes: number;
    tempsTotalSecondes: number;
    parQuestion: { cle: string; numero: string; tempsSecondes: number; tempsConseilleSecondes: number; statut: StatutTemps }[];
  } | null;
  notionsPrioritaires?: { notionId: string; notionNom: string; pointsPerdus: number }[];
}

export const formatPoints = (x: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export function formatDuree(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m} min ${String(r).padStart(2, "0")}`;
  return `${r} s`;
}

export const titreEpreuve = (p: Passage) => p.epreuve.examen ?? "Épreuve";
export const sousTitreEpreuve = (p: Passage, defaut: string) =>
  [p.epreuve.session, p.epreuve.annee, p.epreuve.etablissementSource].filter(Boolean).join(" · ") || defaut;

export function CorrectionView({ correction }: { correction: Correction }) {
  const reussi = correction.pointsObtenus >= correction.pointsMax / 2;
  return (
    <div className="fade-in space-y-3">
      <div className="flex items-baseline gap-2">
        <span className={`font-display font-extrabold text-2xl ${reussi ? "text-primary-deep" : "text-[#8A5A0E]"}`}>
          {formatPoints(correction.pointsObtenus)}
        </span>
        <span className="text-sm text-ink-soft">/ {formatPoints(correction.pointsMax)} pts</span>
      </div>
      <FeedbackBlock variant={reussi ? "ok" : "warn"}>
        <MathText text={correction.explication} />
      </FeedbackBlock>
      {correction.elementsReussis.length > 0 && (
        <div>
          <div className="text-[11px] font-mono uppercase text-primary-deep mb-1">Ce qui t'a rapporté des points</div>
          <ul className="text-sm text-ink list-disc list-inside space-y-0.5">
            {correction.elementsReussis.map((e) => (
              <li key={e}>
                <MathText text={e} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {correction.elementsManquants.length > 0 && (
        <div>
          <div className="text-[11px] font-mono uppercase text-[#8A5A0E] mb-1">Ce qui t'en a fait perdre</div>
          <ul className="text-sm text-ink list-disc list-inside space-y-0.5">
            {correction.elementsManquants.map((e) => (
              <li key={e}>
                <MathText text={e} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const libelleTemps: Record<StatutTemps, { texte: string; classe: string }> = {
  non_abordee: { texte: "non abordée", classe: "text-ink-soft" },
  rapide: { texte: "rapide", classe: "text-primary-deep" },
  dans_le_temps: { texte: "dans le temps", classe: "text-primary-deep" },
  trop_long: { texte: "trop long", classe: "text-[#8A5A0E]" },
};

export function RapportView({
  rapport,
  passage,
  onRetour,
  onRecommencer,
  recommencementEnCours,
  onRelancerCorrection,
  relanceEnCours,
}: {
  rapport: Rapport;
  passage?: Passage;
  onRetour: () => void;
  onRecommencer: () => void;
  recommencementEnCours: boolean;
  onRelancerCorrection?: () => void;
  relanceEnCours?: boolean;
}) {
  const navigate = useNavigate();
  const examen = rapport.mode === "EXAMEN_BLANC";
  const prioritaires = examen
    ? (rapport.notionsPrioritaires ?? [])
    : rapport.parNotion.filter((n) => n.pointsPerdus > 0).slice(0, 3);

  return (
    <div className="space-y-4">
      {rapport.correctionIncomplete && (
        <Card className="bg-accent-tint border-accent">
          <p className="text-sm text-ink mb-3">
            La correction automatique de certaines réponses n'a pas pu se faire. Ta copie est bien enregistrée : relance
            la correction pour obtenir ta note définitive.
          </p>
          {onRelancerCorrection && (
            <Button variant="ghost" onClick={onRelancerCorrection} disabled={relanceEnCours}>
              {relanceEnCours ? "Correction en cours…" : "Relancer la correction"}
            </Button>
          )}
        </Card>
      )}

      <Card className="text-center py-6">
        <div className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-1">
          {examen ? "Ta note à l'examen blanc" : "Ta note"}
          {rapport.correctionIncomplete ? " (provisoire)" : ""}
        </div>
        <div className="font-display font-extrabold text-4xl text-ink">
          {formatPoints(rapport.note)} <span className="text-xl text-ink-soft">/ {formatPoints(rapport.bareme)}</span>
        </div>
        {rapport.bareme !== 20 && <div className="text-sm text-ink-soft mt-1">soit {formatPoints(rapport.noteSur20)} / 20</div>}
        {rapport.nbRepondues < rapport.nbQuestions && (
          <p className="text-xs text-ink-soft mt-2">
            {rapport.nbQuestions - rapport.nbRepondues} question(s) sans réponse comptée(s) 0.
          </p>
        )}
      </Card>

      {prioritaires.length > 0 && (
        <Card>
          <div className="font-display font-bold text-base text-ink mb-2">Là où tu gagneras le plus de points</div>
          <ol className="space-y-1.5 text-sm text-ink list-decimal list-inside">
            {prioritaires.map((n) => (
              <li key={n.notionId ?? n.notionNom}>
                <strong>{n.notionNom}</strong> — {formatPoints(n.pointsPerdus)} pt(s) perdu(s)
              </li>
            ))}
          </ol>
          {examen && (
            <>
              <p className="text-sm text-ink-soft mt-3">Ces notions ont été ajoutées à tes révisions du jour.</p>
              <div className="mt-3">
                <Button variant="ghost" onClick={() => navigate("/revisions")}>
                  Aller à mes révisions
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {rapport.temps && (
        <Card>
          <div className="font-display font-bold text-base text-ink mb-1">Gestion du temps</div>
          <p className="text-sm text-ink-soft mb-3">
            {formatDuree(rapport.temps.tempsTotalSecondes)} utilisées sur {formatDuree(rapport.temps.dureeSecondes)}. Le temps
            conseillé est réparti selon les points de chaque question.
          </p>
          <ul className="space-y-2.5">
            {rapport.temps.parQuestion.map((t) => {
              const max = Math.max(t.tempsSecondes, t.tempsConseilleSecondes, 1);
              const libelle = libelleTemps[t.statut];
              return (
                <li key={t.cle}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ink">Question {t.numero}</span>
                    <span className={`font-mono text-xs ${libelle.classe}`}>
                      {formatDuree(t.tempsSecondes)} / {formatDuree(t.tempsConseilleSecondes)} conseillées · {libelle.texte}
                    </span>
                  </div>
                  <div className="relative h-2 bg-line rounded-lg overflow-hidden">
                    <div
                      className={`h-full rounded-lg ${t.statut === "trop_long" ? "bg-accent" : "bg-primary"}`}
                      style={{ width: `${(t.tempsSecondes / max) * 100}%` }}
                    />
                    <div
                      className="absolute top-0 h-full w-[2px] bg-ink"
                      style={{ left: `${(t.tempsConseilleSecondes / max) * 100}%` }}
                      title="Temps conseillé"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card>
        <div className="font-display font-bold text-base text-ink mb-3">Détail par notion</div>
        <div className="space-y-2.5">
          {rapport.parNotion.map((n) => (
            <div key={n.notionId ?? n.notionNom}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-ink">{n.notionNom}</span>
                <span className="font-mono text-ink-soft">
                  {formatPoints(n.pointsObtenus)} / {formatPoints(n.points)}
                </span>
              </div>
              <div className="h-2 bg-line rounded-lg overflow-hidden">
                <div
                  className="h-full bg-primary rounded-lg"
                  style={{ width: `${n.points > 0 ? (n.pointsObtenus / n.points) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="font-display font-bold text-base text-ink mb-2">Détail par question</div>
        <ul className="divide-y divide-line">
          {rapport.parQuestion.map((q) => {
            const question = passage?.questions.find((x) => x.cle === q.cle);
            const correction = passage?.reponses[q.cle];
            const ligne = (
              <span className="flex justify-between w-full text-sm">
                <span className="text-ink">Question {q.numero}</span>
                <span className={`font-mono ${!q.repondue || q.ratee ? "text-[#8A5A0E]" : "text-primary-deep"}`}>
                  {q.repondue ? `${formatPoints(q.pointsObtenus)} / ${formatPoints(q.points)}` : "sans réponse"}
                </span>
              </span>
            );
            // En examen blanc, les corrections détaillées ne sont visibles qu'ici, après la remise.
            return examen && question && correction ? (
              <li key={q.cle} className="py-1.5">
                <details>
                  <summary className="cursor-pointer list-none">{ligne}</summary>
                  <div className="mt-2 space-y-3">
                    <div className="text-sm text-ink whitespace-pre-wrap">
                      <MathText text={question.enonce} />
                    </div>
                    <div className="bg-bg rounded-[10px] p-2.5 text-sm text-ink whitespace-pre-wrap">
                      <div className="text-[11px] font-mono uppercase text-ink-soft mb-1">
                        {correction.depuisPhoto ? "📷 Lu sur ta copie" : "Ta réponse"}
                      </div>
                      <MathText text={correction.reponseDonnee} />
                    </div>
                    <CorrectionView correction={correction} />
                  </div>
                </details>
              </li>
            ) : (
              <li key={q.cle} className="py-1.5">
                {ligne}
              </li>
            );
          })}
        </ul>
        {examen && <p className="text-xs text-ink-soft mt-2">Touche une question pour voir sa correction détaillée.</p>}
      </Card>

      <div className="flex flex-col gap-2">
        <Button onClick={onRetour}>Retour aux épreuves</Button>
        <Button variant="ghost" onClick={onRecommencer} disabled={recommencementEnCours}>
          {recommencementEnCours ? "Préparation…" : examen ? "Refaire un examen blanc" : "Repasser cette épreuve"}
        </Button>
      </div>
    </div>
  );
}
