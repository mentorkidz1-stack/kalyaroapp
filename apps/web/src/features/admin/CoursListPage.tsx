import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api-client";
import { Card, Button, FormField, fieldInputClass, Spinner } from "../../design-system";

interface Cours {
  id: string;
  titre: string;
  statutExtraction: "PENDING" | "DONE" | "ERROR";
}
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

export function CoursListPage() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"SCOLAIRE" | "UNIVERSITAIRE">("SCOLAIRE");
  const [classeId, setClasseId] = useState("");
  const [matiereScolaireId, setMatiereScolaireId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [ueId, setUeId] = useState("");
  const [titre, setTitre] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: cours, isLoading } = useQuery({
    queryKey: ["admin-cours"],
    queryFn: () => api.get<Cours[]>("/api/admin/cours"),
  });

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

  const upload = useMutation({
    mutationFn: (formData: FormData) => api.upload("/api/admin/cours", formData),
    onSuccess: () => {
      setTitre("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["admin-cours"] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const matiereId = type === "SCOLAIRE" ? matiereScolaireId : ueId;
    if (!matiereId || !file) {
      setError("Choisis une matière et un fichier PDF.");
      return;
    }
    const formData = new FormData();
    formData.append("titre", titre);
    formData.append("matiereId", matiereId);
    formData.append("pdf", file);
    upload.mutate(formData);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display font-extrabold text-xl text-ink">Cours</h1>

      <Card>
        <div className="font-display font-bold text-base text-ink mb-4">Ajouter un cours (PDF)</div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
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
            <div className="flex gap-2">
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
            <div className="flex gap-2">
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

          <FormField label="Titre du cours">
            <input className={fieldInputClass} value={titre} onChange={(e) => setTitre(e.target.value)} required />
          </FormField>

          <FormField label="Fichier PDF">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </FormField>

          {error && <p className="text-sm text-alert">{error}</p>}

          <Button type="submit" className="w-auto" disabled={upload.isPending}>
            {upload.isPending ? "Envoi…" : "Importer"}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="font-display font-bold text-base text-ink mb-4">Cours existants</div>
        {isLoading && <Spinner />}
        <div className="space-y-2">
          {cours?.map((c) => (
            <Link
              key={c.id}
              to={`/admin/cours/${c.id}`}
              className="flex items-center justify-between px-4 py-3 rounded-[14px] border-2 border-line hover:border-primary"
            >
              <span className="font-semibold text-sm text-ink">{c.titre}</span>
              <span className="text-xs font-mono text-ink-soft">{c.statutExtraction}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
