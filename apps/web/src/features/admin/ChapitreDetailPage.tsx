import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { Card, Button, Badge, FormField, fieldInputClass, Spinner, Table, Th, Td, MathText, FigureRenderer } from "../../design-system";
import { lireNombre, verifierQuestionSurFigure, type ReponseAttendue, type TypeReponse } from "@kalyaro/shared";
import { EditeurFigure } from "./EditeurFigure";

interface Notion {
  id: string;
  nom: string;
  description: string | null;
}
interface PrerequisEdge {
  notionId: string;
  prerequisNotionId: string;
  statut: "PROPOSE_IA" | "VALIDE_ADMIN";
  notion: Notion;
  prerequisNotion: Notion;
}
interface QuestionQcm {
  id: string;
  enonce: string;
  choix: string[];
  bonneReponse: string;
  difficulte: string;
  source: "IA" | "MANUEL";
  statut: "BROUILLON" | "A_VALIDER" | "PUBLIE";
  notions: { notion: Notion }[];
  varianteDeId: string | null;
  _count: { variantes: number };
  /** Figure dessinée par l'application (description JSON validée). */
  figure?: unknown;
  typeReponse: TypeReponse;
  reponseAttendue: ReponseAttendue | null;
}
interface ResultatVariantesLot {
  questionsTraitees: number;
  questionsCompletes: number;
  variantesCreees: number;
  echecs: { questionId: string; enonce: string; erreur: string }[];
}
interface QuestionSaisieLibre {
  id: string;
  enonce: string;
  reponseReference: string;
  source: "IA" | "MANUEL";
  statut: "BROUILLON" | "A_VALIDER" | "PUBLIE";
  notions: { notion: Notion }[];
  figure?: unknown;
}

export function ChapitreDetailPage() {
  const { chapitreId } = useParams<{ chapitreId: string }>();
  if (!chapitreId) return null;
  return (
    <div className="space-y-6">
      <h1 className="font-display font-extrabold text-xl text-ink">Chapitre</h1>
      <ChapitrePdfSection chapitreId={chapitreId} />
      <NotionsSection chapitreId={chapitreId} />
      <GrapheSection chapitreId={chapitreId} />
      <QcmSection chapitreId={chapitreId} />
      <SaisieLibreSection chapitreId={chapitreId} />
    </div>
  );
}

interface ChapitreDetail {
  id: string;
  titre: string;
  fichierPdfUrl: string | null;
  statutExtraction: "PENDING" | "DONE" | "ERROR" | null;
}

function ChapitrePdfSection({ chapitreId }: { chapitreId: string }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: chapitre, isLoading } = useQuery({
    queryKey: ["chapitre", chapitreId],
    queryFn: () => api.get<ChapitreDetail>(`/api/admin/chapitres/${chapitreId}`),
  });

  const upload = useMutation({
    mutationFn: (formData: FormData) => api.upload(`/api/admin/chapitres/${chapitreId}/pdf`, formData),
    onSuccess: () => {
      setError(null);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["chapitre", chapitreId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  function handleUpload() {
    if (!file) {
      setError("Choisis un fichier PDF.");
      return;
    }
    const formData = new FormData();
    formData.append("pdf", file);
    upload.mutate(formData);
  }

  return (
    <Card>
      <div className="font-display font-bold text-base text-ink mb-3">PDF du chapitre (optionnel)</div>
      {isLoading && <Spinner />}
      {chapitre?.fichierPdfUrl ? (
        <div className="flex items-center gap-2 mb-3">
          <Badge variant={chapitre.statutExtraction === "DONE" ? "ok" : "warn"}>
            {chapitre.statutExtraction === "DONE" ? "Texte extrait" : chapitre.statutExtraction}
          </Badge>
          <span className="text-xs text-ink-soft">
            Utilisé en priorité par l'IA pour ce chapitre (au lieu du PDF du cours).
          </span>
        </div>
      ) : (
        <p className="text-sm text-ink-soft mb-3">
          Pas de PDF propre à ce chapitre — l'IA utilise le texte du cours parent.
        </p>
      )}
      <div className="flex gap-2 items-end">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <Button type="button" className="w-auto" onClick={handleUpload} disabled={upload.isPending}>
          {upload.isPending ? "Envoi…" : "Uploader"}
        </Button>
      </div>
      {error && <p className="text-sm text-alert mt-2">{error}</p>}
    </Card>
  );
}

function useNotions(chapitreId: string) {
  return useQuery({
    queryKey: ["notions", chapitreId],
    queryFn: () => api.get<Notion[]>(`/api/admin/chapitres/${chapitreId}/notions`),
  });
}

function NotionsSection({ chapitreId }: { chapitreId: string }) {
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const { data: notions, isLoading } = useNotions(chapitreId);

  const create = useMutation({
    mutationFn: () => api.post(`/api/admin/chapitres/${chapitreId}/notions`, { nom }),
    onSuccess: () => {
      setNom("");
      queryClient.invalidateQueries({ queryKey: ["notions", chapitreId] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/notions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notions", chapitreId] }),
  });

  return (
    <Card>
      <div className="font-display font-bold text-base text-ink mb-4">Notions</div>
      {isLoading && <Spinner />}
      <div className="flex flex-wrap gap-2 mb-4">
        {notions?.map((n) => (
          <span
            key={n.id}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-line text-sm font-semibold text-ink"
          >
            {n.nom}
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Supprimer la notion "${n.nom}" ? Cela supprimera aussi ses arêtes de prérequis liées.`)) {
                  remove.mutate(n.id);
                }
              }}
              className="text-alert text-xs"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={fieldInputClass}
          placeholder="Nouvelle notion"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
        <Button type="button" className="w-auto" onClick={() => create.mutate()} disabled={!nom.trim()}>
          Ajouter
        </Button>
      </div>
    </Card>
  );
}

function GrapheSection({ chapitreId }: { chapitreId: string }) {
  const queryClient = useQueryClient();
  const { data: notions } = useNotions(chapitreId);
  const { data: edges, isLoading } = useQuery({
    queryKey: ["prerequis", chapitreId],
    queryFn: () => api.get<PrerequisEdge[]>(`/api/admin/chapitres/${chapitreId}/prerequis`),
  });
  const [notionId, setNotionId] = useState("");
  const [prerequisNotionId, setPrerequisNotionId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["prerequis", chapitreId] });

  const create = useMutation({
    mutationFn: () => api.post("/api/admin/prerequis", { notionId, prerequisNotionId }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  const validate = useMutation({
    mutationFn: (edge: { notionId: string; prerequisNotionId: string }) =>
      api.patch(`/api/admin/prerequis/${edge.notionId}/${edge.prerequisNotionId}`, {}),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (edge: { notionId: string; prerequisNotionId: string }) =>
      api.delete(`/api/admin/prerequis/${edge.notionId}/${edge.prerequisNotionId}`),
    onSuccess: invalidate,
  });
  const proposeIa = useMutation({
    mutationFn: () => api.post(`/api/admin/chapitres/${chapitreId}/notions/propose-graphe-ia`, {}),
    onSuccess: () => {
      setError(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["notions", chapitreId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="font-display font-bold text-base text-ink">Graphe de prérequis</div>
        <Button type="button" variant="ghost" className="w-auto" onClick={() => proposeIa.mutate()} disabled={proposeIa.isPending}>
          {proposeIa.isPending ? "Génération…" : "Proposer le graphe par IA"}
        </Button>
      </div>
      {isLoading && <Spinner />}
      <Table>
        <thead>
          <tr>
            <Th>Notion</Th>
            <Th>Dépend de</Th>
            <Th>Statut</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {edges?.map((e) => (
            <tr key={`${e.notionId}-${e.prerequisNotionId}`}>
              <Td>{e.notion.nom}</Td>
              <Td>{e.prerequisNotion.nom}</Td>
              <Td>
                <Badge variant={e.statut === "VALIDE_ADMIN" ? "ok" : "warn"}>
                  {e.statut === "VALIDE_ADMIN" ? "Validé" : "Proposé IA"}
                </Badge>
              </Td>
              <Td>
                <div className="flex gap-2">
                  {e.statut === "PROPOSE_IA" && (
                    <button
                      type="button"
                      className="text-primary-deep text-xs font-mono"
                      onClick={() => validate.mutate(e)}
                    >
                      Valider
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-alert text-xs font-mono"
                    onClick={() => {
                      if (window.confirm(`Supprimer l'arête "${e.notion.nom} dépend de ${e.prerequisNotion.nom}" ?`)) {
                        remove.mutate(e);
                      }
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="flex gap-2 items-end mt-4">
        <FormField label="Notion">
          <select className={fieldInputClass} value={notionId} onChange={(e) => setNotionId(e.target.value)}>
            <option value="">—</option>
            {notions?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nom}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Dépend de">
          <select
            className={fieldInputClass}
            value={prerequisNotionId}
            onChange={(e) => setPrerequisNotionId(e.target.value)}
          >
            <option value="">—</option>
            {notions?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nom}
              </option>
            ))}
          </select>
        </FormField>
        <Button
          type="button"
          className="w-auto"
          onClick={() => create.mutate()}
          disabled={!notionId || !prerequisNotionId}
        >
          Ajouter l'arête
        </Button>
      </div>
      {error && <p className="text-sm text-alert mt-2">{error}</p>}
    </Card>
  );
}

/** Variantes demandées par question : de quoi ne jamais resservir la question ratée. */
const NOMBRE_VARIANTES = 3;

function QcmSection({ chapitreId }: { chapitreId: string }) {
  const queryClient = useQueryClient();
  const { data: notions } = useNotions(chapitreId);
  const { data: questions, isLoading } = useQuery({
    queryKey: ["questions-qcm", chapitreId],
    queryFn: () => api.get<QuestionQcm[]>(`/api/admin/chapitres/${chapitreId}/questions-qcm`),
  });

  const [enonce, setEnonce] = useState("");
  const [choix, setChoix] = useState(["", "", "", ""]);
  const [bonneReponse, setBonneReponse] = useState("");
  const [notionIds, setNotionIds] = useState<string[]>([]);
  const [figure, setFigure] = useState<unknown | null>(null);
  const [figureValide, setFigureValide] = useState(true);
  // Réponse sur figure : valeurs saisies en texte (virgule décimale acceptée).
  const [typeReponse, setTypeReponse] = useState<TypeReponse>("CHOIX");
  const [attendu, setAttendu] = useState(ATTENDU_VIDE);
  const [nombreIa, setNombreIa] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["questions-qcm", chapitreId] });

  const reponseAttendue = construireReponseAttendue(typeReponse, attendu);
  const erreursFigure = typeReponse === "CHOIX" ? [] : verifierQuestionSurFigure(typeReponse, figure, reponseAttendue);

  const create = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/chapitres/${chapitreId}/questions-qcm`, {
        enonce,
        typeReponse,
        difficulte: "MOYEN",
        notionIds,
        ...(typeReponse === "CHOIX" ? { choix: choix.filter((c) => c.trim()), bonneReponse } : { reponseAttendue }),
        ...(figure != null ? { figure } : {}),
      }),
    onSuccess: () => {
      setError(null);
      setEnonce("");
      setChoix(["", "", "", ""]);
      setBonneReponse("");
      setNotionIds([]);
      setFigure(null);
      setFigureValide(true);
      setAttendu(ATTENDU_VIDE);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  const generateIa = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/chapitres/${chapitreId}/questions-qcm/generate-ia`, { nombreQuestions: nombreIa }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  const publier = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/questions-qcm/${id}`, { statut: "PUBLIE" }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/questions-qcm/${id}`),
    onSuccess: invalidate,
  });
  const genererVariantes = useMutation({
    mutationFn: (id: string) =>
      api.post<unknown[]>(`/api/admin/questions-qcm/${id}/variantes/generate-ia`, { nombre: NOMBRE_VARIANTES }),
    onSuccess: (creees) => {
      setError(null);
      setInfo(`${creees.length} variante(s) créée(s), à vérifier dans la file de validation.`);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  const genererVariantesLot = useMutation({
    mutationFn: () =>
      api.post<ResultatVariantesLot>(`/api/admin/chapitres/${chapitreId}/questions-qcm/variantes/generate-ia`, {
        nombre: NOMBRE_VARIANTES,
      }),
    onSuccess: (r) => {
      setError(
        r.echecs.length > 0
          ? `Échec sur ${r.echecs.length} question(s) : ${r.echecs.map((e) => e.erreur).join(" · ")}`
          : null
      );
      setInfo(
        `${r.variantesCreees} variante(s) créée(s) pour ${r.questionsTraitees} question(s) publiée(s)` +
          (r.questionsCompletes > 0 ? ` (${r.questionsCompletes} en avaient déjà assez)` : "") +
          ". À vérifier dans la file de validation."
      );
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="font-display font-bold text-base text-ink">Banque de questions — QCM</div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            className="w-auto"
            onClick={() => genererVariantesLot.mutate()}
            disabled={genererVariantesLot.isPending}
            title={`Complète chaque question publiée jusqu'à ${NOMBRE_VARIANTES} variantes`}
          >
            {genererVariantesLot.isPending ? "Variantes en cours…" : "Variantes pour tout le chapitre"}
          </Button>
          <input
            type="number"
            min={1}
            max={20}
            value={nombreIa}
            onChange={(e) => setNombreIa(Number(e.target.value))}
            className={`${fieldInputClass} w-20`}
          />
          <Button type="button" variant="ghost" className="w-auto" onClick={() => generateIa.mutate()} disabled={generateIa.isPending}>
            {generateIa.isPending ? "Génération…" : "Générer par IA"}
          </Button>
        </div>
      </div>

      {info && <p className="text-sm text-primary-deep mb-3">{info}</p>}
      {isLoading && <Spinner />}
      <div className="space-y-3 mb-4">
        {questions?.map((q) => (
          <div key={q.id} className="border border-line rounded-[14px] p-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={q.source === "IA" ? "ai" : "manual"}>{q.source}</Badge>
              <Badge variant={q.statut === "PUBLIE" ? "ok" : "warn"}>{q.statut}</Badge>
              {q.varianteDeId && <Badge variant="manual">Variante</Badge>}
              {q.typeReponse !== "CHOIX" && <Badge variant="manual">{LIBELLES_TYPE[q.typeReponse]}</Badge>}
              {q._count.variantes > 0 && (
                <span className="text-[11px] font-mono text-ink-soft">{q._count.variantes} variante(s)</span>
              )}
              {q.notions.map((n) => (
                <span key={n.notion.id} className="text-[11px] font-mono text-ink-soft">
                  {n.notion.nom}
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold text-ink mb-2"><MathText text={q.enonce} /></p>
            {q.figure != null && (
              <FigureRenderer
                figure={q.figure}
                afficherErreurs
                interaction={
                  q.reponseAttendue?.type === "PLACER_POINT"
                    ? { point: [q.reponseAttendue.x, q.reponseAttendue.y], onPlacer: () => {}, desactive: true, correct: true }
                    : undefined
                }
              />
            )}
            {q.typeReponse !== "CHOIX" && (
              <p className="text-xs text-primary-deep font-bold mb-2">
                Attendu : {q.bonneReponse}
                {q.reponseAttendue && ` (tolérance ± ${String(q.reponseAttendue.tolerance).replace(".", ",")})`}
              </p>
            )}
            <ul className="text-xs text-ink-soft mb-2 list-disc list-inside">
              {q.choix.map((c) => (
                <li key={c} className={c === q.bonneReponse ? "text-primary-deep font-bold" : ""}>
                  <MathText text={c} />
                </li>
              ))}
            </ul>
            <div className="flex gap-3 flex-wrap">
              {q.statut !== "PUBLIE" && (
                <button type="button" className="text-primary-deep text-xs font-mono" onClick={() => publier.mutate(q.id)}>
                  Publier
                </button>
              )}
              {q.statut === "PUBLIE" && q.typeReponse === "CHOIX" && (
                <button
                  type="button"
                  className="text-primary-deep text-xs font-mono disabled:opacity-50"
                  disabled={genererVariantes.isPending}
                  onClick={() => genererVariantes.mutate(q.id)}
                >
                  {genererVariantes.isPending && genererVariantes.variables === q.id
                    ? "Génération…"
                    : `Générer ${NOMBRE_VARIANTES} variantes`}
                </button>
              )}
              <button
                type="button"
                className="text-alert text-xs font-mono"
                onClick={() => {
                  if (window.confirm("Supprimer ce QCM ?")) remove.mutate(q.id);
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-4 space-y-2">
        <FormField label="Énoncé">
          <textarea
            className={`${fieldInputClass} min-h-[60px]`}
            value={enonce}
            onChange={(e) => setEnonce(e.target.value)}
          />
        </FormField>
        <FormField label="Type de réponse">
          <select className={fieldInputClass} value={typeReponse} onChange={(e) => setTypeReponse(e.target.value as TypeReponse)}>
            <option value="CHOIX">Choix multiples</option>
            <option value="PLACER_POINT">{LIBELLES_TYPE.PLACER_POINT} (dans un repère)</option>
            <option value="LIRE_VALEUR">{LIBELLES_TYPE.LIRE_VALEUR} (sur la figure)</option>
          </select>
        </FormField>
        {typeReponse === "CHOIX" && (
          <>
          <div className="grid grid-cols-2 gap-2">
            {choix.map((c, i) => (
              <input
                key={i}
                className={fieldInputClass}
                placeholder={`Choix ${i + 1}`}
                value={c}
                onChange={(e) => {
                  const next = [...choix];
                  next[i] = e.target.value;
                  setChoix(next);
                }}
              />
            ))}
          </div>
          <FormField label="Bonne réponse (doit correspondre exactement à un choix)">
            <input className={fieldInputClass} value={bonneReponse} onChange={(e) => setBonneReponse(e.target.value)} />
          </FormField>
          </>
        )}
        {typeReponse !== "CHOIX" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CHAMPS_ATTENDU[typeReponse].map(([cle, label, exemple]) => (
              <FormField key={cle} label={label}>
                <input
                  className={fieldInputClass}
                  inputMode={cle === "unite" ? "text" : "decimal"}
                  value={attendu[cle]}
                  placeholder={exemple}
                  onChange={(e) => setAttendu({ ...attendu, [cle]: e.target.value })}
                />
              </FormField>
            ))}
          </div>
        )}
        <FormField label="Notions testées">
          <select
            multiple
            className={`${fieldInputClass} h-24`}
            value={notionIds}
            onChange={(e) => setNotionIds(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {notions?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nom}
              </option>
            ))}
          </select>
        </FormField>
        <EditeurFigure
          valeur={figure}
          onChange={(f, valide) => {
            setFigure(f);
            setFigureValide(valide);
          }}
        />
        {typeReponse === "PLACER_POINT" && figureValide && (figure as { type?: string } | null)?.type === "repere" && (
          <div className="border border-line rounded-[10px] p-2">
            <p className="text-xs text-ink-soft">Touchez le repère pour poser le point attendu (ou saisissez x et y).</p>
            <FigureRenderer
              figure={figure}
              interaction={{
                point: reponseAttendue?.type === "PLACER_POINT" ? [reponseAttendue.x, reponseAttendue.y] : null,
                pasGrille: lireNombre(attendu.pasGrille) ?? null,
                onPlacer: (x, y) => setAttendu({ ...attendu, x: String(x).replace(".", ","), y: String(y).replace(".", ",") }),
              }}
            />
          </div>
        )}
        {typeReponse !== "CHOIX" && erreursFigure.length > 0 && (
          <ul className="text-xs text-alert list-disc list-inside">
            {erreursFigure.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          className="w-auto"
          onClick={() => create.mutate()}
          disabled={
            !enonce.trim() ||
            (typeReponse === "CHOIX" ? !bonneReponse.trim() : erreursFigure.length > 0) ||
            notionIds.length === 0 ||
            !figureValide
          }
        >
          Créer le QCM
        </Button>
      </div>
      {error && <p className="text-sm text-alert mt-2">{error}</p>}
    </Card>
  );
}

const LIBELLES_TYPE: Record<TypeReponse, string> = {
  CHOIX: "Choix multiples",
  PLACER_POINT: "Placer un point",
  LIRE_VALEUR: "Lire une valeur",
};

const ATTENDU_VIDE = { x: "", y: "", valeur: "", tolerance: "", pasGrille: "0,5", unite: "" };
type ChampAttendu = keyof typeof ATTENDU_VIDE;

const CHAMPS_ATTENDU: Record<"PLACER_POINT" | "LIRE_VALEUR", [ChampAttendu, string, string][]> = {
  PLACER_POINT: [
    ["x", "x attendu", ""],
    ["y", "y attendu", ""],
    ["tolerance", "Tolérance (±)", "0,25"],
    ["pasGrille", "Aimant (pas)", "0,5"],
  ],
  LIRE_VALEUR: [
    ["valeur", "Valeur attendue", ""],
    ["tolerance", "Tolérance (±)", "0,1"],
    ["unite", "Unité (facultatif)", "k F"],
  ],
};

/** Réponse attendue à partir des champs du formulaire ; undefined tant qu'elle est incomplète. */
function construireReponseAttendue(type: TypeReponse, c: typeof ATTENDU_VIDE): ReponseAttendue | undefined {
  const tolerance = lireNombre(c.tolerance);
  if (type === "PLACER_POINT") {
    const x = lireNombre(c.x);
    const y = lireNombre(c.y);
    const pas = lireNombre(c.pasGrille);
    if (x === null || y === null || tolerance === null || tolerance <= 0) return undefined;
    return { type, x, y, tolerance, ...(pas && pas > 0 ? { pasGrille: pas } : {}) };
  }
  if (type === "LIRE_VALEUR") {
    const valeur = lireNombre(c.valeur);
    if (valeur === null || tolerance === null || tolerance < 0) return undefined;
    return { type, valeur, tolerance, ...(c.unite.trim() ? { unite: c.unite.trim() } : {}) };
  }
  return undefined;
}

function SaisieLibreSection({ chapitreId }: { chapitreId: string }) {
  const queryClient = useQueryClient();
  const { data: notions } = useNotions(chapitreId);
  const { data: questions, isLoading } = useQuery({
    queryKey: ["questions-saisie-libre", chapitreId],
    queryFn: () => api.get<QuestionSaisieLibre[]>(`/api/admin/chapitres/${chapitreId}/questions-saisie-libre`),
  });

  const [enonce, setEnonce] = useState("");
  const [reponseReference, setReponseReference] = useState("");
  const [notionIds, setNotionIds] = useState<string[]>([]);
  const [nombreIa, setNombreIa] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["questions-saisie-libre", chapitreId] });

  const create = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/chapitres/${chapitreId}/questions-saisie-libre`, { enonce, reponseReference, notionIds }),
    onSuccess: () => {
      setError(null);
      setEnonce("");
      setReponseReference("");
      setNotionIds([]);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  const generateIa = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/chapitres/${chapitreId}/questions-saisie-libre/generate-ia`, { nombreQuestions: nombreIa }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  const publier = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/questions-saisie-libre/${id}`, { statut: "PUBLIE" }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/questions-saisie-libre/${id}`),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="font-display font-bold text-base text-ink">Banque de questions — saisie libre</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={20}
            value={nombreIa}
            onChange={(e) => setNombreIa(Number(e.target.value))}
            className={`${fieldInputClass} w-20`}
          />
          <Button type="button" variant="ghost" className="w-auto" onClick={() => generateIa.mutate()} disabled={generateIa.isPending}>
            {generateIa.isPending ? "Génération…" : "Générer par IA"}
          </Button>
        </div>
      </div>
      {isLoading && <Spinner />}
      <div className="space-y-3 mb-4">
        {questions?.map((q) => (
          <div key={q.id} className="border border-line rounded-[14px] p-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant={q.source === "IA" ? "ai" : "manual"}>{q.source}</Badge>
              <Badge variant={q.statut === "PUBLIE" ? "ok" : "warn"}>{q.statut}</Badge>
            </div>
            <p className="text-sm font-semibold text-ink mb-1"><MathText text={q.enonce} /></p>
            {q.figure != null && <FigureRenderer figure={q.figure} afficherErreurs />}
            <p className="text-xs text-ink-soft mb-2">Référence : <MathText text={q.reponseReference} /></p>
            <div className="flex gap-3">
              {q.statut !== "PUBLIE" && (
                <button type="button" className="text-primary-deep text-xs font-mono" onClick={() => publier.mutate(q.id)}>
                  Publier
                </button>
              )}
              <button
                type="button"
                className="text-alert text-xs font-mono"
                onClick={() => {
                  if (window.confirm("Supprimer cette question à saisie libre ?")) remove.mutate(q.id);
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-4 space-y-2">
        <FormField label="Énoncé">
          <textarea
            className={`${fieldInputClass} min-h-[60px]`}
            value={enonce}
            onChange={(e) => setEnonce(e.target.value)}
          />
        </FormField>
        <FormField label="Réponse de référence">
          <textarea
            className={`${fieldInputClass} min-h-[60px]`}
            value={reponseReference}
            onChange={(e) => setReponseReference(e.target.value)}
          />
        </FormField>
        <FormField label="Notions testées">
          <select
            multiple
            className={`${fieldInputClass} h-24`}
            value={notionIds}
            onChange={(e) => setNotionIds(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {notions?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nom}
              </option>
            ))}
          </select>
        </FormField>
        <Button
          type="button"
          className="w-auto"
          onClick={() => create.mutate()}
          disabled={!enonce.trim() || !reponseReference.trim() || notionIds.length === 0}
        >
          Créer la question
        </Button>
      </div>
      {error && <p className="text-sm text-alert mt-2">{error}</p>}
    </Card>
  );
}
