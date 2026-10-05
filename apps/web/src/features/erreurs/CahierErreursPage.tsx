import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { AppHeader } from "../../components/AppHeader";
import { Button, Card, EmptyState, ErrorState, LoadingState, MathText } from "../../design-system";
import { REMEDES, type TypeErreur } from "./remedes";

interface ErreurResume {
  id: string;
  date: string;
  typeErreur: TypeErreur | null;
  explication: string | null;
  enonce: string;
  source: "QCM" | "SAISIE_LIBRE" | "EPREUVE";
  statut: "A_TRAVAILLER" | "EN_VOIE_DE_CORRECTION";
}
interface ErreurSignature {
  notionId: string;
  notionNom: string;
  chapitreId: string | null;
  typeErreur: TypeErreur;
  nombre: number;
  derniere: ErreurResume;
}
interface NotionDuCahier {
  notionId: string;
  notionNom: string;
  chapitreId: string | null;
  aTravailler: number;
  enVoieDeCorrection: number;
  parType: Partial<Record<TypeErreur, number>>;
  erreurs: ErreurResume[];
}
export interface CahierErreurs {
  aTravailler: number;
  enVoieDeCorrection: number;
  nonClassees: number;
  parType: { typeErreur: TypeErreur; aTravailler: number; enVoieDeCorrection: number }[];
  signatures: ErreurSignature[];
  notions: NotionDuCahier[];
}

export function useCahierErreurs() {
  return useQuery({ queryKey: ["cahier-erreurs"], queryFn: () => api.get<CahierErreurs>("/api/eleve/cahier-erreurs") });
}

const fois = (n: number) => `${n} fois`;

/** « Mon cahier d'erreurs » (chantier 3.2) : erreurs classées, signatures et remèdes. */
export function CahierErreursPage() {
  const { data, isLoading, error, refetch } = useCahierErreurs();
  const vide = data && data.aTravailler + data.enVoieDeCorrection === 0;

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader title="Mon cahier d'erreurs" subtitle="Kalyaro" />
      <div className="max-w-lg mx-auto p-5 space-y-4">
        {isLoading && <LoadingState label="Chargement de ton cahier…" />}
        {error && <ErrorState message="Impossible de charger ton cahier d'erreurs." onRetry={() => refetch()} />}
        {vide && (
          <EmptyState
            icon="📒"
            title="Ton cahier est vierge"
            message="Chaque erreur que tu feras sera rangée ici, avec sa cause et un remède. Se tromper fait partie de l'apprentissage !"
          />
        )}
        {data && !vide && (
          <>
            <p className="text-sm text-ink">
              <strong>{data.aTravailler}</strong> erreur{data.aTravailler > 1 ? "s" : ""} à travailler ·{" "}
              <strong className="text-primary-deep">{data.enVoieDeCorrection}</strong> en voie de correction
              {data.nonClassees > 0 && <span className="text-ink-soft"> · {data.nonClassees} en cours d'analyse</span>}
            </p>

            {data.signatures.length > 0 && (
              <section>
                <h2 className="font-display font-bold text-base text-ink mb-2">🎯 Tes {data.signatures.length} erreurs signature</h2>
                <div className="space-y-3">
                  {data.signatures.map((s, i) => (
                    <CarteSignature key={`${s.notionId}-${s.typeErreur}`} rang={i + 1} signature={s} />
                  ))}
                </div>
              </section>
            )}

            {data.parType.length > 0 && (
              <Card>
                <h2 className="font-display font-bold text-base text-ink mb-3">Par type d'erreur</h2>
                <RepartitionTypes parType={data.parType} />
              </Card>
            )}

            <section>
              <h2 className="font-display font-bold text-base text-ink mb-2">Par notion</h2>
              <div className="space-y-3">
                {data.notions.map((n) => (
                  <CarteNotion key={n.notionId} notion={n} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function CarteSignature({ rang, signature: s }: { rang: number; signature: ErreurSignature }) {
  const remede = REMEDES[s.typeErreur];
  return (
    <Card className="border-l-4 border-l-alert">
      <div className="text-[11px] font-mono uppercase tracking-wide text-ink-soft">
        N° {rang} · {fois(s.nombre)}
      </div>
      <div className="font-display font-bold text-ink mt-0.5">
        {remede.icone} {remede.libelle} — {s.notionNom}
      </div>
      {s.derniere.explication && <p className="text-sm text-ink-soft mt-1"><MathText text={s.derniere.explication} /></p>}
      <Remede typeErreur={s.typeErreur} notionId={s.notionId} chapitreId={s.chapitreId} enonce={s.derniere.enonce} />
    </Card>
  );
}

function RepartitionTypes({ parType }: { parType: CahierErreurs["parType"] }) {
  const max = Math.max(...parType.map((t) => t.aTravailler + t.enVoieDeCorrection));
  return (
    <ul className="space-y-2">
      {parType.map((t) => {
        const total = t.aTravailler + t.enVoieDeCorrection;
        return (
          <li key={t.typeErreur} className="text-sm">
            <div className="flex justify-between text-ink">
              <span>
                {REMEDES[t.typeErreur].icone} {REMEDES[t.typeErreur].libelle}
              </span>
              <span className="font-mono text-xs text-ink-soft">
                {t.aTravailler} à travailler{t.enVoieDeCorrection > 0 ? ` · ${t.enVoieDeCorrection} ✓` : ""}
              </span>
            </div>
            <div className="h-2 rounded-full bg-line mt-1 flex overflow-hidden" aria-hidden>
              <div className="bg-alert" style={{ width: `${(t.aTravailler / max) * 100}%` }} />
              <div className="bg-primary" style={{ width: `${(t.enVoieDeCorrection / max) * 100}%` }} />
            </div>
            <span className="sr-only">{total} erreurs</span>
          </li>
        );
      })}
    </ul>
  );
}

function CarteNotion({ notion: n }: { notion: NotionDuCahier }) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <Card>
      <button type="button" className="w-full text-left" onClick={() => setOuverte((o) => !o)} aria-expanded={ouverte}>
        <div className="flex justify-between items-start gap-2">
          <span className="font-display font-bold text-ink">{n.notionNom}</span>
          <span className="text-xs font-mono whitespace-nowrap">
            {n.aTravailler > 0 && <span className="text-alert">{n.aTravailler} à travailler</span>}
            {n.aTravailler > 0 && n.enVoieDeCorrection > 0 && " · "}
            {n.enVoieDeCorrection > 0 && <span className="text-primary-deep">{n.enVoieDeCorrection} ✓</span>}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {(Object.entries(n.parType) as [TypeErreur, number][]).map(([type, nb]) => (
            <span key={type} className="text-[11px] font-mono bg-bg rounded-full px-2 py-0.5 text-ink-soft">
              {REMEDES[type].icone} {REMEDES[type].libelle} ×{nb}
            </span>
          ))}
        </div>
      </button>
      {ouverte && (
        <ul className="mt-3 space-y-2 border-t border-line pt-3">
          {n.erreurs.map((e) => (
            <li key={e.id} className="text-sm">
              <div className="flex items-center gap-2 text-[11px] font-mono text-ink-soft">
                <span>{new Date(e.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                <span>{e.typeErreur ? REMEDES[e.typeErreur].libelle : "analyse en cours"}</span>
                <span className={e.statut === "EN_VOIE_DE_CORRECTION" ? "text-primary-deep" : "text-alert"}>
                  {e.statut === "EN_VOIE_DE_CORRECTION" ? "✓ en voie de correction" : "à travailler"}
                </span>
              </div>
              <p className="text-ink line-clamp-3">
                <MathText text={e.enonce} />
              </p>
              {e.explication && <p className="text-ink-soft text-xs mt-0.5"><MathText text={e.explication} /></p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Remède adapté au type : conseil fixe + actions (fiche validée, série de QCM, décorticage). */
function Remede({
  typeErreur,
  notionId,
  chapitreId,
  enonce,
}: {
  typeErreur: TypeErreur;
  notionId: string;
  chapitreId: string | null;
  enonce: string;
}) {
  const navigate = useNavigate();
  const remede = REMEDES[typeErreur];
  const [panneau, setPanneau] = useState<"FICHE" | "DECORTIQUER" | null>(null);

  return (
    <div className="mt-3 bg-bg rounded-[12px] p-3">
      <div className="text-sm font-bold text-ink">💡 {remede.titre}</div>
      <p className="text-sm text-ink-soft mt-1">{remede.conseil}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {remede.actions.includes("FICHE") && (
          <Button variant="ghost" className="w-auto text-sm py-2" onClick={() => setPanneau(panneau === "FICHE" ? null : "FICHE")}>
            📖 La fiche
          </Button>
        )}
        {remede.actions.includes("DECORTIQUER") && (
          <Button
            variant="ghost"
            className="w-auto text-sm py-2"
            onClick={() => setPanneau(panneau === "DECORTIQUER" ? null : "DECORTIQUER")}
          >
            🔍 Décortiquer
          </Button>
        )}
        {remede.actions.includes("SERIE_QCM") && chapitreId && (
          <Button className="w-auto text-sm py-2" onClick={() => navigate(`/parcours/${chapitreId}/qcm/${notionId}`)}>
            {typeErreur === "CALCUL" ? "⚡ Série rapide" : "S'entraîner"}
          </Button>
        )}
        {remede.actions.includes("EPREUVES") && (
          <Button className="w-auto text-sm py-2" onClick={() => navigate("/epreuves")}>
            📝 Une épreuve
          </Button>
        )}
      </div>
      {panneau === "FICHE" && <FicheNotion notionId={notionId} chapitreId={chapitreId} />}
      {panneau === "DECORTIQUER" && <Decorticage enonce={enonce} />}
    </div>
  );
}

function FicheNotion({ notionId, chapitreId }: { notionId: string; chapitreId: string | null }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["fiche-notion", notionId],
    queryFn: () => api.get<{ fiche: { id: string; contenu: string } | null }>(`/api/eleve/notions/${notionId}/fiche`),
  });
  if (isLoading) return <p className="text-xs text-ink-soft mt-2">Chargement de la fiche…</p>;
  if (!data?.fiche) {
    return (
      <p className="text-sm text-ink-soft mt-2">
        Pas encore de fiche validée pour cette notion : relis la partie du cours correspondante
        {chapitreId && (
          <>
            {" "}
            (
            <button type="button" className="underline text-primary-deep" onClick={() => navigate(`/parcours/${chapitreId}`)}>
              ouvrir le chapitre
            </button>
            )
          </>
        )}
        .
      </p>
    );
  }
  return (
    <div className="mt-3 bg-accent-tint border border-accent rounded-[10px] p-3 text-sm text-ink whitespace-pre-wrap">
      <MathText text={data.fiche.contenu} />
    </div>
  );
}

const ETAPES_DECORTICAGE = [
  "Qu'est-ce qu'on te demande exactement ? Repère le verbe (calculer, justifier, comparer…) et ce qu'il faut trouver.",
  "Quelles données dois-tu utiliser ? Liste-les, y compris celles cachées dans un tableau ou une figure.",
  "Y a-t-il une condition, une unité ou une précision à respecter (arrondi, intervalle, « en fonction de »…) ?",
  "Reformule la question avec tes mots, en une phrase.",
];

/** Exercice de décorticage de consigne, sur l'énoncé de la dernière erreur. */
function Decorticage({ enonce }: { enonce: string }) {
  const [faites, setFaites] = useState<boolean[]>(ETAPES_DECORTICAGE.map(() => false));
  const fini = faites.every(Boolean);
  return (
    <div className="mt-3 space-y-3">
      <div className="bg-white border border-line rounded-[10px] p-3 text-sm text-ink">
        <MathText text={enonce} />
      </div>
      <ol className="space-y-2">
        {ETAPES_DECORTICAGE.map((etape, i) => (
          <li key={etape}>
            <label className="flex gap-2 items-start text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-[#1B7A5C]"
                checked={faites[i]}
                onChange={() => setFaites((f) => f.map((v, j) => (j === i ? !v : v)))}
              />
              <span>
                <strong>{i + 1}.</strong> {etape}
              </span>
            </label>
          </li>
        ))}
      </ol>
      {fini && (
        <p className="text-sm font-semibold text-primary-deep">
          Bravo ! Fais ce petit rituel à chaque énoncé : c'est lui qui évite ce type d'erreur.
        </p>
      )}
    </div>
  );
}
