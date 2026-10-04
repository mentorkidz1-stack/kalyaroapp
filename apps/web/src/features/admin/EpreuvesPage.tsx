import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { Card, Button, Badge, FormField, fieldInputClass, Spinner, MathText } from "../../design-system";
import { EpreuveQuestionsPanel } from "./EpreuveQuestionsPanel";

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
interface MetadonneesEpreuve {
  annee: number | null;
  session: string | null;
  examen: string | null;
  etablissementSource: string | null;
  dureeMinutes: number | null;
  bareme: number | null;
}
interface Epreuve extends MetadonneesEpreuve {
  id: string;
  enonce: string;
  sourceCorrige: "FOURNI" | "GENERE";
  _count: { questions: number };
}

/** Champs de métadonnées tels que saisis dans un formulaire (tout en texte). */
type MetaFormulaire = Record<keyof MetadonneesEpreuve, string>;
const META_VIDE: MetaFormulaire = { annee: "", session: "", examen: "", etablissementSource: "", dureeMinutes: "", bareme: "" };
const metaVersFormulaire = (e: MetadonneesEpreuve): MetaFormulaire => ({
  annee: e.annee?.toString() ?? "",
  session: e.session ?? "",
  examen: e.examen ?? "",
  etablissementSource: e.etablissementSource ?? "",
  dureeMinutes: e.dureeMinutes?.toString() ?? "",
  bareme: e.bareme?.toString() ?? "",
});
const nombreOuNull = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);
const texteOuNull = (v: string) => (v.trim() ? v.trim() : null);
const metaVersApi = (m: MetaFormulaire) => ({
  annee: nombreOuNull(m.annee),
  session: texteOuNull(m.session),
  examen: texteOuNull(m.examen),
  etablissementSource: texteOuNull(m.etablissementSource),
  dureeMinutes: nombreOuNull(m.dureeMinutes),
  bareme: nombreOuNull(m.bareme),
});

function ChampsMetadonnees({ valeur, onChange }: { valeur: MetaFormulaire; onChange: (m: MetaFormulaire) => void }) {
  const champ = (cle: keyof MetaFormulaire, placeholder: string, className = "") => (
    <input
      className={`${fieldInputClass} ${className}`}
      placeholder={placeholder}
      value={valeur[cle]}
      inputMode={cle === "annee" || cle === "dureeMinutes" || cle === "bareme" ? "decimal" : undefined}
      onChange={(e) => onChange({ ...valeur, [cle]: e.target.value })}
    />
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {champ("examen", "Examen (ex. Partiel L1)")}
      {champ("session", "Session (ex. Rattrapage)")}
      {champ("annee", "Année (ex. 2025)")}
      {champ("etablissementSource", "Université / faculté d'origine")}
      {champ("dureeMinutes", "Durée (minutes)")}
      {champ("bareme", "Barème (ex. 20)")}
    </div>
  );
}

function BadgesEpreuve({ e }: { e: Epreuve }) {
  const elements = [
    e.examen,
    e.session,
    e.annee?.toString(),
    e.etablissementSource,
    e.bareme ? `sur ${e.bareme}` : null,
    e.dureeMinutes ? `${e.dureeMinutes} min` : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1.5 mb-1">
      {elements.map((t) => (
        <Badge key={t} variant="manual">
          {t}
        </Badge>
      ))}
      <Badge variant={e._count.questions > 0 ? "ok" : "warn"}>
        {e._count.questions > 0 ? `${e._count.questions} question(s)` : "non découpée"}
      </Badge>
    </div>
  );
}

function MetadonneesEditables({ epreuve, onSaved }: { epreuve: Epreuve; onSaved: () => void }) {
  const [meta, setMeta] = useState<MetaFormulaire>(metaVersFormulaire(epreuve));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api.patch(`/api/admin/epreuves/${epreuve.id}`, metaVersApi(meta)),
    onSuccess: () => {
      setError(null);
      onSaved();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  return (
    <div className="mt-3 space-y-2">
      <ChampsMetadonnees valeur={meta} onChange={setMeta} />
      <Button type="button" variant="ghost" className="w-auto" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Enregistrement…" : "Enregistrer les informations"}
      </Button>
      {error && <p className="text-sm text-alert">{error}</p>}
    </div>
  );
}
interface CorrigeType {
  id: string;
  contenu: string;
  estPrincipal: boolean;
  statutValidation: "A_VALIDER" | "VALIDE";
}

export function EpreuvesPage() {
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
      <h1 className="font-display font-extrabold text-xl text-ink">Épreuves & corrigés</h1>

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

      {matiereId && <EpreuvesForMatiere key={matiereId} matiereId={matiereId} />}
    </div>
  );
}

function EpreuvesForMatiere({ matiereId }: { matiereId: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"TEXTE" | "PDF">("TEXTE");
  const [enonce, setEnonce] = useState("");
  const [meta, setMeta] = useState<MetaFormulaire>(META_VIDE);
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: epreuves, isLoading } = useQuery({
    queryKey: ["epreuves", matiereId],
    queryFn: () => api.get<Epreuve[]>(`/api/admin/matieres/${matiereId}/epreuves`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["epreuves", matiereId] });

  const create = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/matieres/${matiereId}/epreuves`, { enonce, sourceCorrige: "FOURNI", ...metaVersApi(meta) }),
    onSuccess: () => {
      setEnonce("");
      setMeta(META_VIDE);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const createFromPdf = useMutation({
    mutationFn: (formData: FormData) => api.upload(`/api/admin/matieres/${matiereId}/epreuves`, formData),
    onSuccess: () => {
      setFile(null);
      setMeta(META_VIDE);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  function handleCreate() {
    setError(null);
    if (mode === "TEXTE") {
      if (!enonce.trim()) return;
      create.mutate();
    } else {
      if (!file) {
        setError("Choisis un fichier PDF.");
        return;
      }
      const formData = new FormData();
      formData.append("sourceCorrige", "FOURNI");
      for (const [cle, valeur] of Object.entries(meta)) if (valeur.trim()) formData.append(cle, valeur.trim());
      formData.append("pdf", file);
      createFromPdf.mutate(formData);
    }
  }

  return (
    <Card>
      <div className="font-display font-bold text-base text-ink mb-4">Épreuves</div>
      {isLoading && <Spinner />}
      <div className="space-y-2 mb-4">
        {epreuves?.map((e) => (
          <div key={e.id} className="border border-line rounded-[14px] p-3">
            <BadgesEpreuve e={e} />
            <button
              type="button"
              onClick={() => setSelected(selected === e.id ? null : e.id)}
              className="text-sm font-semibold text-ink text-left"
            >
              <MathText text={e.enonce} />
            </button>
            {selected === e.id && (
              <>
                <MetadonneesEditables epreuve={e} onSaved={invalidate} />
                <EpreuveQuestionsPanel epreuveId={e.id} bareme={e.bareme} />
                <div className="mt-3 text-[11px] font-mono text-ink-soft">
                  CORRIGÉS DE L'ÉPREUVE ENTIÈRE {e._count.questions > 0 ? "(non utilisés : l'épreuve est découpée)" : "(utilisés tant qu'elle n'est pas découpée)"}
                </div>
                <CorrigesList epreuveId={e.id} />
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setMode("TEXTE")}
          className={`px-3 py-2 rounded-[10px] border-2 text-sm font-bold ${
            mode === "TEXTE" ? "border-primary bg-primary-tint text-primary-deep" : "border-line text-ink-soft"
          }`}
        >
          Texte
        </button>
        <button
          type="button"
          onClick={() => setMode("PDF")}
          className={`px-3 py-2 rounded-[10px] border-2 text-sm font-bold ${
            mode === "PDF" ? "border-primary bg-primary-tint text-primary-deep" : "border-line text-ink-soft"
          }`}
        >
          PDF
        </button>
      </div>
      <div className="mb-2">
        <ChampsMetadonnees valeur={meta} onChange={setMeta} />
      </div>
      <div className="flex gap-2">
        {mode === "TEXTE" ? (
          <textarea
            className={`${fieldInputClass} min-h-[60px]`}
            placeholder="Énoncé de la nouvelle épreuve"
            value={enonce}
            onChange={(e) => setEnonce(e.target.value)}
          />
        ) : (
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        )}
        <Button
          type="button"
          className="w-auto"
          onClick={handleCreate}
          disabled={create.isPending || createFromPdf.isPending}
        >
          {create.isPending || createFromPdf.isPending ? "Création…" : "Créer"}
        </Button>
      </div>
      {error && <p className="text-sm text-alert mt-2">{error}</p>}
    </Card>
  );
}

function CorrigesList({ epreuveId }: { epreuveId: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"TEXTE" | "PDF">("TEXTE");
  const [contenu, setContenu] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: corriges } = useQuery({
    queryKey: ["corriges", epreuveId],
    queryFn: () => api.get<CorrigeType[]>(`/api/admin/epreuves/${epreuveId}/corriges`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["corriges", epreuveId] });

  const create = useMutation({
    mutationFn: () => api.post(`/api/admin/epreuves/${epreuveId}/corriges`, { contenu, estPrincipal: true }),
    onSuccess: () => {
      setContenu("");
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  const createFromPdf = useMutation({
    mutationFn: (formData: FormData) => api.upload(`/api/admin/epreuves/${epreuveId}/corriges`, formData),
    onSuccess: () => {
      setFile(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  const generateIa = useMutation({
    mutationFn: () => api.post(`/api/admin/epreuves/${epreuveId}/corriges/generate-ia`, {}),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  const valider = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/corriges/${id}`, { statutValidation: "VALIDE" }),
    onSuccess: invalidate,
  });

  function handleCreate() {
    setError(null);
    if (mode === "TEXTE") {
      if (!contenu.trim()) return;
      create.mutate();
    } else {
      if (!file) {
        setError("Choisis un fichier PDF.");
        return;
      }
      const formData = new FormData();
      formData.append("estPrincipal", "true");
      formData.append("pdf", file);
      createFromPdf.mutate(formData);
    }
  }

  return (
    <div className="bg-bg rounded-[14px] p-3 mt-3">
      <div className="text-xs font-mono uppercase text-ink-soft mb-2">Corrigés-types</div>
      <div className="space-y-2 mb-3">
        {corriges?.map((c) => (
          <div key={c.id} className="bg-surface border border-line rounded-[10px] p-2">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={c.statutValidation === "VALIDE" ? "ok" : "warn"}>{c.statutValidation}</Badge>
              {c.estPrincipal && <Badge variant="ai">Principal</Badge>}
            </div>
            <p className="text-xs text-ink whitespace-pre-wrap mb-1"><MathText text={c.contenu} /></p>
            {c.statutValidation !== "VALIDE" && (
              <button type="button" className="text-primary-deep text-xs font-mono" onClick={() => valider.mutate(c.id)}>
                Valider
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-2">
        <Button type="button" variant="ghost" className="w-auto" onClick={() => generateIa.mutate()} disabled={generateIa.isPending}>
          {generateIa.isPending ? "Génération…" : "Générer par IA"}
        </Button>
      </div>
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setMode("TEXTE")}
          className={`px-3 py-2 rounded-[10px] border-2 text-sm font-bold ${
            mode === "TEXTE" ? "border-primary bg-primary-tint text-primary-deep" : "border-line text-ink-soft"
          }`}
        >
          Texte
        </button>
        <button
          type="button"
          onClick={() => setMode("PDF")}
          className={`px-3 py-2 rounded-[10px] border-2 text-sm font-bold ${
            mode === "PDF" ? "border-primary bg-primary-tint text-primary-deep" : "border-line text-ink-soft"
          }`}
        >
          PDF
        </button>
      </div>
      <div className="flex gap-2">
        {mode === "TEXTE" ? (
          <textarea
            className={`${fieldInputClass} min-h-[50px]`}
            placeholder="Corrigé fourni manuellement"
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
          />
        ) : (
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        )}
        <Button
          type="button"
          className="w-auto"
          onClick={handleCreate}
          disabled={create.isPending || createFromPdf.isPending}
        >
          Ajouter
        </Button>
      </div>
      {error && <p className="text-sm text-alert mt-2">{error}</p>}
    </div>
  );
}
