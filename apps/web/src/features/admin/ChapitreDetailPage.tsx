import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { formatMathText } from "../../lib/format-math";
import { Card, Button, Badge, FormField, fieldInputClass, Spinner, Table, Th, Td } from "../../design-system";

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
}
interface QuestionSaisieLibre {
  id: string;
  enonce: string;
  reponseReference: string;
  source: "IA" | "MANUEL";
  statut: "BROUILLON" | "A_VALIDER" | "PUBLIE";
  notions: { notion: Notion }[];
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
  const [nombreIa, setNombreIa] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["questions-qcm", chapitreId] });

  const create = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/chapitres/${chapitreId}/questions-qcm`, {
        enonce,
        choix: choix.filter((c) => c.trim()),
        bonneReponse,
        difficulte: "MOYEN",
        notionIds,
      }),
    onSuccess: () => {
      setError(null);
      setEnonce("");
      setChoix(["", "", "", ""]);
      setBonneReponse("");
      setNotionIds([]);
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

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="font-display font-bold text-base text-ink">Banque de questions — QCM</div>
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
              {q.notions.map((n) => (
                <span key={n.notion.id} className="text-[11px] font-mono text-ink-soft">
                  {n.notion.nom}
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold text-ink mb-2">{formatMathText(q.enonce)}</p>
            <ul className="text-xs text-ink-soft mb-2 list-disc list-inside">
              {q.choix.map((c) => (
                <li key={c} className={c === q.bonneReponse ? "text-primary-deep font-bold" : ""}>
                  {formatMathText(c)}
                </li>
              ))}
            </ul>
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
          disabled={!enonce.trim() || !bonneReponse.trim() || notionIds.length === 0}
        >
          Créer le QCM
        </Button>
      </div>
      {error && <p className="text-sm text-alert mt-2">{error}</p>}
    </Card>
  );
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
            <p className="text-sm font-semibold text-ink mb-1">{formatMathText(q.enonce)}</p>
            <p className="text-xs text-ink-soft mb-2">Référence : {formatMathText(q.reponseReference)}</p>
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
