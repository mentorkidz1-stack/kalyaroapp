import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { Card, Button, FormField, fieldInputClass } from "../../design-system";

interface Classe {
  id: string;
  nom: string;
}
interface MatiereScolaire {
  id: string;
  nom: string;
}
interface Filiere {
  id: string;
  nom: string;
}
interface NiveauUniversitaire {
  id: string;
  nom: string;
}
interface UEMatiere {
  id: string;
  nom: string;
}
interface Evaluation {
  id: string;
  titre: string;
  dureeMinutes: number;
  bareme: number;
  fichierPdfUrl: string | null;
}

export function EvaluationsPage() {
  const [type, setType] = useState<"SCOLAIRE" | "UNIVERSITAIRE">("SCOLAIRE");
  const [classeId, setClasseId] = useState("");
  const [matiereScolaireId, setMatiereScolaireId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [ueId, setUeId] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<Classe[]>("/api/structure/classes"),
    enabled: type === "SCOLAIRE",
  });
  const { data: matieresScolaires } = useQuery({
    queryKey: ["matieres-scolaires", classeId],
    queryFn: () => api.get<MatiereScolaire[]>(`/api/structure/classes/${classeId}/matieres`),
    enabled: !!classeId,
  });
  const { data: filieres } = useQuery({
    queryKey: ["filieres"],
    queryFn: () => api.get<Filiere[]>("/api/structure/filieres"),
    enabled: type === "UNIVERSITAIRE",
  });
  const { data: niveaux } = useQuery({
    queryKey: ["niveaux", filiereId],
    queryFn: () => api.get<NiveauUniversitaire[]>(`/api/structure/filieres/${filiereId}/niveaux`),
    enabled: !!filiereId,
  });
  const { data: ues } = useQuery({
    queryKey: ["ue-matieres", niveauId],
    queryFn: () => api.get<UEMatiere[]>(`/api/structure/niveaux/${niveauId}/ue-matieres`),
    enabled: !!niveauId,
  });

  const matiereId = type === "SCOLAIRE" ? matiereScolaireId : ueId;

  return (
    <div className="space-y-6">
      <h1 className="font-display font-extrabold text-xl text-ink">Évaluations</h1>

      <Card>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setType("SCOLAIRE")}
            className={`px-3 py-2 rounded-[10px] border-2 text-sm font-bold ${
              type === "SCOLAIRE" ? "border-primary bg-primary-tint text-primary-deep" : "border-line text-ink-soft"
            }`}
          >
            Scolaire
          </button>
          <button
            type="button"
            onClick={() => setType("UNIVERSITAIRE")}
            className={`px-3 py-2 rounded-[10px] border-2 text-sm font-bold ${
              type === "UNIVERSITAIRE"
                ? "border-accent bg-accent-tint text-[#8A5A0E]"
                : "border-line text-ink-soft"
            }`}
          >
            Universitaire
          </button>
        </div>

        {type === "SCOLAIRE" ? (
          <div className="flex gap-2 items-end">
            <FormField label="Classe">
              <select
                className={fieldInputClass}
                value={classeId}
                onChange={(e) => {
                  setClasseId(e.target.value);
                  setMatiereScolaireId("");
                }}
              >
                <option value="">—</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Matière">
              <select
                className={fieldInputClass}
                value={matiereScolaireId}
                onChange={(e) => setMatiereScolaireId(e.target.value)}
              >
                <option value="">—</option>
                {matieresScolaires?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            <FormField label="Filière">
              <select
                className={fieldInputClass}
                value={filiereId}
                onChange={(e) => {
                  setFiliereId(e.target.value);
                  setNiveauId("");
                  setUeId("");
                }}
              >
                <option value="">—</option>
                {filieres?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Niveau">
              <select
                className={fieldInputClass}
                value={niveauId}
                onChange={(e) => {
                  setNiveauId(e.target.value);
                  setUeId("");
                }}
              >
                <option value="">—</option>
                {niveaux?.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nom}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="UE">
              <select className={fieldInputClass} value={ueId} onChange={(e) => setUeId(e.target.value)}>
                <option value="">—</option>
                {ues?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nom}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        )}
      </Card>

      {matiereId && <EvaluationsForMatiere key={matiereId} matiereId={matiereId} />}
    </div>
  );
}

function EvaluationsForMatiere({ matiereId }: { matiereId: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"TEXTE" | "PDF">("TEXTE");
  const [titre, setTitre] = useState("");
  const [enonce, setEnonce] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dureeMinutes, setDureeMinutes] = useState(45);
  const [bareme, setBareme] = useState(20);
  const [error, setError] = useState<string | null>(null);

  const { data: evaluations, isLoading } = useQuery({
    queryKey: ["evaluations", matiereId],
    queryFn: () => api.get<Evaluation[]>(`/api/admin/matieres/${matiereId}/evaluations`),
  });

  function resetForm() {
    setTitre("");
    setEnonce("");
    setFile(null);
  }

  const create = useMutation({
    mutationFn: (formData: FormData) => api.upload(`/api/admin/matieres/${matiereId}/evaluations`, formData),
    onSuccess: () => {
      setError(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["evaluations", matiereId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/evaluations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["evaluations", matiereId] }),
  });

  function handleSubmit() {
    setError(null);
    if (!titre.trim()) {
      setError("Saisis un titre.");
      return;
    }
    if (mode === "TEXTE" && !enonce.trim()) {
      setError("Saisis un énoncé.");
      return;
    }
    if (mode === "PDF" && !file) {
      setError("Choisis un fichier PDF.");
      return;
    }
    const formData = new FormData();
    formData.append("titre", titre);
    if (mode === "TEXTE") formData.append("enonce", enonce);
    formData.append("dureeMinutes", String(dureeMinutes));
    formData.append("bareme", String(bareme));
    if (mode === "PDF" && file) formData.append("pdf", file);
    create.mutate(formData);
  }

  return (
    <Card>
      <div className="font-display font-bold text-base text-ink mb-4">Évaluations de cette matière</div>
      {isLoading && <p className="text-sm text-ink-soft">Chargement…</p>}
      <div className="space-y-2 mb-4">
        {evaluations?.map((e) => (
          <div key={e.id} className="flex items-center justify-between border border-line rounded-[14px] p-3">
            <div>
              <span className="font-semibold text-sm text-ink">{e.titre}</span>
              <span className="text-xs text-ink-soft ml-2">
                {e.dureeMinutes} min · sur {e.bareme}
                {e.fichierPdfUrl ? " · PDF" : ""}
              </span>
            </div>
            <div className="flex gap-3 items-center">
              <button
                type="button"
                className="text-alert text-xs font-mono"
                onClick={() => {
                  if (window.confirm(`Supprimer l'évaluation "${e.titre}" ? Les copies déjà soumises seront aussi supprimées.`)) {
                    remove.mutate(e.id);
                  }
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
        {!isLoading && (evaluations?.length ?? 0) === 0 && (
          <p className="text-sm text-ink-soft">Aucune évaluation pour l'instant.</p>
        )}
      </div>

      <div className="border-t border-line pt-4 space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("TEXTE");
              resetForm();
            }}
            className={`px-3 py-2 rounded-[10px] border-2 text-sm font-bold ${
              mode === "TEXTE" ? "border-primary bg-primary-tint text-primary-deep" : "border-line text-ink-soft"
            }`}
          >
            Texte
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("PDF");
              resetForm();
            }}
            className={`px-3 py-2 rounded-[10px] border-2 text-sm font-bold ${
              mode === "PDF" ? "border-primary bg-primary-tint text-primary-deep" : "border-line text-ink-soft"
            }`}
          >
            PDF
          </button>
        </div>

        <FormField label="Titre">
          <input className={fieldInputClass} value={titre} onChange={(e) => setTitre(e.target.value)} />
        </FormField>

        {mode === "TEXTE" && (
          <FormField label="Énoncé">
            <textarea
              className={`${fieldInputClass} min-h-[80px]`}
              value={enonce}
              onChange={(e) => setEnonce(e.target.value)}
            />
          </FormField>
        )}

        {mode === "PDF" && (
          <FormField label="Fichier PDF">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </FormField>
        )}

        <div className="flex gap-2">
          <FormField label="Durée (minutes)">
            <input
              type="number"
              min={1}
              className={fieldInputClass}
              value={dureeMinutes}
              onChange={(e) => setDureeMinutes(Number(e.target.value))}
            />
          </FormField>
          <FormField label="Barème">
            <input
              type="number"
              min={1}
              className={fieldInputClass}
              value={bareme}
              onChange={(e) => setBareme(Number(e.target.value))}
            />
          </FormField>
        </div>

        {error && <p className="text-sm text-alert">{error}</p>}

        <Button
          type="button"
          className="w-auto"
          onClick={handleSubmit}
          disabled={!titre.trim() || (mode === "TEXTE" ? !enonce.trim() : !file) || create.isPending}
        >
          {create.isPending ? "Création…" : "Créer l'évaluation"}
        </Button>
      </div>
    </Card>
  );
}
