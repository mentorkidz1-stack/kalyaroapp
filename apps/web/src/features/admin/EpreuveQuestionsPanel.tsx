import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { Badge, Button, MathText, Spinner, fieldInputClass } from "../../design-system";
import { EditeurFigure } from "./EditeurFigure";

interface NotionRef {
  id: string;
  nom: string;
}
interface CorrigeQuestion {
  id: string;
  contenu: string;
  estPrincipal: boolean;
  statutValidation: "A_VALIDER" | "VALIDE";
}
interface QuestionEpreuve {
  id: string;
  numero: string;
  enonce: string;
  points: number;
  notionId: string | null;
  figure?: unknown;
  corriges: CorrigeQuestion[];
}
interface QuestionsResponse {
  questions: QuestionEpreuve[];
  notionsDisponibles: NotionRef[];
}
interface Proposition {
  questions: { numero: string; enonce: string; points: number; notionId: string | null; figure?: unknown }[];
  totalPoints: number;
  avertissement: string | null;
}
interface Brouillon {
  /** Clé locale stable pour React (les questions proposées n'ont pas encore d'id). */
  cle: string;
  id?: string;
  numero: string;
  enonce: string;
  points: string;
  notionId: string;
  figure: unknown | null;
  /** false si la figure saisie ne passe pas le schéma : l'enregistrement est bloqué. */
  figureValide: boolean;
}

let compteur = 0;
const nouvelleCle = () => `local-${++compteur}`;
const versBrouillon = (q: {
  id?: string;
  numero: string;
  enonce: string;
  points: number;
  notionId: string | null;
  figure?: unknown;
}): Brouillon => ({
  cle: q.id ?? nouvelleCle(),
  id: q.id,
  numero: q.numero,
  enonce: q.enonce,
  points: String(q.points),
  notionId: q.notionId ?? "",
  figure: q.figure ?? null,
  figureValide: true,
});
const messageErreur = (err: unknown) => (err instanceof ApiError ? err.message : "Erreur");

/**
 * Découpage d'une épreuve en questions notées (chantier 2.1). La proposition IA n'est qu'un
 * brouillon : rien n'est visible des étudiants tant que l'admin n'a pas enregistré le
 * découpage ET validé au moins un corrigé par question.
 */
export function EpreuveQuestionsPanel({ epreuveId, bareme }: { epreuveId: string; bareme: number | null }) {
  const queryClient = useQueryClient();
  const queryKey = ["questions-epreuve", epreuveId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => api.get<QuestionsResponse>(`/api/admin/epreuves/${epreuveId}/questions`),
  });

  const [brouillon, setBrouillon] = useState<Brouillon[]>([]);
  const [modifie, setModifie] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data && !modifie) setBrouillon(data.questions.map(versBrouillon));
  }, [data, modifie]);

  const proposer = useMutation({
    mutationFn: () => api.post<Proposition>(`/api/admin/epreuves/${epreuveId}/questions/proposer-ia`, bareme ? { bareme } : {}),
    onSuccess: (p) => {
      setError(null);
      setBrouillon(p.questions.map(versBrouillon));
      setModifie(true);
      setInfo(
        `${p.questions.length} question(s) proposée(s) pour ${p.totalPoints} points. Relis, corrige, puis enregistre.` +
          (p.avertissement ? ` ⚠ ${p.avertissement}` : "")
      );
    },
    onError: (err) => setError(messageErreur(err)),
  });

  const enregistrer = useMutation({
    mutationFn: () =>
      api.put<QuestionsResponse>(`/api/admin/epreuves/${epreuveId}/questions`, {
        questions: brouillon.map((q) => ({
          ...(q.id ? { id: q.id } : {}),
          numero: q.numero.trim(),
          enonce: q.enonce.trim(),
          points: Number(q.points.replace(",", ".")),
          notionId: q.notionId || null,
          figure: q.figure,
        })),
      }),
    onSuccess: (r) => {
      setError(null);
      setInfo("Découpage enregistré. Ajoute maintenant au moins un corrigé validé par question.");
      setModifie(false);
      queryClient.setQueryData(queryKey, r);
      queryClient.invalidateQueries({ queryKey: ["epreuves"] });
    },
    onError: (err) => setError(messageErreur(err)),
  });

  function majFigure(cle: string, figure: unknown | null, valide: boolean) {
    setBrouillon((b) => b.map((q) => (q.cle === cle ? { ...q, figure, figureValide: valide } : q)));
    setModifie(true);
  }
  function maj(cle: string, champ: "numero" | "enonce" | "points" | "notionId", valeur: string) {
    setBrouillon((b) => b.map((q) => (q.cle === cle ? { ...q, [champ]: valeur } : q)));
    setModifie(true);
  }
  function deplacer(index: number, sens: -1 | 1) {
    setBrouillon((b) => {
      const copie = [...b];
      const cible = index + sens;
      if (cible < 0 || cible >= copie.length) return b;
      [copie[index], copie[cible]] = [copie[cible]!, copie[index]!];
      return copie;
    });
    setModifie(true);
  }
  function retirer(cle: string) {
    setBrouillon((b) => b.filter((q) => q.cle !== cle));
    setModifie(true);
  }
  function ajouter() {
    setBrouillon((b) => [...b, { cle: nouvelleCle(), numero: String(b.length + 1), enonce: "", points: "1", notionId: "", figure: null, figureValide: true }]);
    setModifie(true);
  }

  const total = brouillon.reduce((s, q) => s + (Number(q.points.replace(",", ".")) || 0), 0);
  const invalide = brouillon.some(
    (q) => !q.numero.trim() || !q.enonce.trim() || !(Number(q.points.replace(",", ".")) > 0) || !q.figureValide
  );

  if (isLoading) return <Spinner />;

  return (
    <div className="mt-3 border-t border-line pt-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-bold text-ink">
          Questions ({brouillon.length}) · {total} pt{total > 1 ? "s" : ""}
          {bareme ? ` / barème ${bareme}` : ""}
          {bareme && Math.abs(total - bareme) > 0.001 && brouillon.length > 0 && (
            <span className="text-alert font-normal"> — le total ne correspond pas au barème (la note sera ramenée au barème)</span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-auto"
          disabled={proposer.isPending}
          onClick={() => {
            if (brouillon.length === 0 || window.confirm("Remplacer le découpage affiché par une proposition de l'IA ?")) {
              proposer.mutate();
            }
          }}
        >
          {proposer.isPending ? "Analyse du sujet…" : "Proposer le découpage (IA)"}
        </Button>
      </div>

      {brouillon.length === 0 && (
        <p className="text-sm text-ink-soft">
          Épreuve non découpée : elle est proposée comme une seule question, notée avec les corrigés de l'épreuve ci-dessous.
        </p>
      )}

      {brouillon.map((q, i) => (
        <div key={q.cle} className="border border-line rounded-[12px] p-2.5 space-y-2">
          <div className="flex gap-2 items-center flex-wrap">
            <input
              className={`${fieldInputClass} w-20`}
              value={q.numero}
              onChange={(e) => maj(q.cle, "numero", e.target.value)}
              aria-label="Numéro"
              placeholder="1.a"
            />
            <input
              className={`${fieldInputClass} w-20`}
              value={q.points}
              inputMode="decimal"
              onChange={(e) => maj(q.cle, "points", e.target.value)}
              aria-label="Points"
            />
            <span className="text-xs text-ink-soft">pts</span>
            <select
              className={`${fieldInputClass} flex-1 min-w-[160px]`}
              value={q.notionId}
              onChange={(e) => maj(q.cle, "notionId", e.target.value)}
              aria-label="Notion"
            >
              <option value="">— Notion non rattachée —</option>
              {data?.notionsDisponibles.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nom}
                </option>
              ))}
            </select>
            <div className="flex gap-2 text-xs font-mono">
              <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0} aria-label="Monter">
                ↑
              </button>
              <button type="button" onClick={() => deplacer(i, 1)} disabled={i === brouillon.length - 1} aria-label="Descendre">
                ↓
              </button>
              <button type="button" className="text-alert" onClick={() => retirer(q.cle)}>
                Retirer
              </button>
            </div>
          </div>
          <textarea
            className={`${fieldInputClass} min-h-[52px]`}
            value={q.enonce}
            onChange={(e) => maj(q.cle, "enonce", e.target.value)}
            placeholder="Consigne de la question"
          />
          <EditeurFigure valeur={q.figure} onChange={(figure, valide) => majFigure(q.cle, figure, valide)} />
          {!modifie && q.id && <CorrigesQuestion questionId={q.id} corriges={data?.questions.find((x) => x.id === q.id)?.corriges ?? []} epreuveId={epreuveId} />}
        </div>
      ))}

      <div className="flex gap-2 flex-wrap items-center">
        <Button type="button" variant="ghost" className="w-auto" onClick={ajouter}>
          + Ajouter une question
        </Button>
        {modifie && (
          <>
            <Button type="button" className="w-auto" disabled={invalide || enregistrer.isPending} onClick={() => enregistrer.mutate()}>
              {enregistrer.isPending ? "Enregistrement…" : "Enregistrer le découpage"}
            </Button>
            <button
              type="button"
              className="text-xs font-mono text-ink-soft underline"
              onClick={() => {
                setModifie(false);
                setInfo(null);
              }}
            >
              Annuler les modifications
            </button>
          </>
        )}
      </div>
      {modifie && <p className="text-xs text-ink-soft">Enregistre le découpage pour pouvoir gérer les corrigés de chaque question.</p>}
      {info && <p className="text-sm text-primary-deep">{info}</p>}
      {error && <p className="text-sm text-alert">{error}</p>}
    </div>
  );
}

function CorrigesQuestion({ questionId, corriges, epreuveId }: { questionId: string; corriges: CorrigeQuestion[]; epreuveId: string }) {
  const queryClient = useQueryClient();
  const [contenu, setContenu] = useState("");
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["questions-epreuve", epreuveId] });
    queryClient.invalidateQueries({ queryKey: ["validation-corriges-questions"] });
  };
  const options = { onSuccess: () => { setError(null); invalidate(); }, onError: (err: unknown) => setError(messageErreur(err)) };

  const ajouter = useMutation({
    mutationFn: () => api.post(`/api/admin/questions-epreuve/${questionId}/corriges`, { contenu, estPrincipal: corriges.length === 0 }),
    ...options,
    onSuccess: () => {
      setContenu("");
      options.onSuccess();
    },
  });
  const genererIa = useMutation({ mutationFn: () => api.post(`/api/admin/questions-epreuve/${questionId}/corriges/generate-ia`, {}), ...options });
  const valider = useMutation({ mutationFn: (id: string) => api.patch(`/api/admin/corriges-questions/${id}`, { statutValidation: "VALIDE" }), ...options });
  const supprimer = useMutation({ mutationFn: (id: string) => api.delete(`/api/admin/corriges-questions/${id}`), ...options });

  const nbValides = corriges.filter((c) => c.statutValidation === "VALIDE").length;

  return (
    <div className="bg-bg rounded-[10px] p-2 space-y-1.5">
      <div className="text-[11px] font-mono text-ink-soft">
        CORRIGÉS {nbValides === 0 ? <span className="text-alert">— aucun corrigé validé : épreuve pas encore proposée aux étudiants</span> : `— ${nbValides} validé(s)`}
      </div>
      {corriges.map((c) => (
        <div key={c.id} className="flex gap-2 items-start text-xs">
          <Badge variant={c.statutValidation === "VALIDE" ? "ok" : "warn"}>{c.statutValidation === "VALIDE" ? "Validé" : "À valider"}</Badge>
          <div className="flex-1 text-ink whitespace-pre-wrap">
            <MathText text={c.contenu} />
          </div>
          {c.statutValidation === "A_VALIDER" && (
            <button type="button" className="text-primary-deep font-mono" onClick={() => valider.mutate(c.id)}>
              Valider
            </button>
          )}
          <button
            type="button"
            className="text-alert font-mono"
            onClick={() => {
              if (window.confirm("Supprimer ce corrigé ?")) supprimer.mutate(c.id);
            }}
          >
            Suppr.
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <textarea
          className={`${fieldInputClass} min-h-[40px] text-xs`}
          placeholder="Corrigé de cette question (validé dès l'ajout)"
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <button type="button" className="text-primary-deep text-xs font-mono disabled:opacity-50" disabled={!contenu.trim() || ajouter.isPending} onClick={() => ajouter.mutate()}>
            Ajouter
          </button>
          <button type="button" className="text-primary-deep text-xs font-mono disabled:opacity-50" disabled={genererIa.isPending} onClick={() => genererIa.mutate()}>
            {genererIa.isPending ? "IA…" : "Corrigé IA"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-alert">{error}</p>}
    </div>
  );
}
