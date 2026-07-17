import { Fragment, useState, type FormEvent, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { Card, Button, FormField, fieldInputClass, Table, Th, Td } from "../../design-system";

interface Classe {
  id: string;
  nom: string;
  niveau: string;
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

export function StructurePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display font-extrabold text-xl text-ink">Classes & filières</h1>
      <ScolaireSection />
      <UniversitaireSection />
    </div>
  );
}

function ScolaireSection() {
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const [niveau, setNiveau] = useState("");
  const [selectedClasse, setSelectedClasse] = useState<string | null>(null);
  const [editingClasseId, setEditingClasseId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editNiveau, setEditNiveau] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<Classe[]>("/api/structure/classes"),
  });

  const createClasse = useMutation({
    mutationFn: () => api.post("/api/admin/classes", { nom, niveau }),
    onSuccess: () => {
      setNom("");
      setNiveau("");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
  const deleteClasse = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/classes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classes"] }),
  });
  const updateClasse = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { nom: string; niveau: string } }) =>
      api.patch(`/api/admin/classes/${id}`, data),
    onSuccess: () => {
      setEditingClasseId(null);
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createClasse.mutate();
  }

  function startEdit(c: Classe, e: MouseEvent) {
    e.stopPropagation();
    setEditingClasseId(c.id);
    setEditNom(c.nom);
    setEditNiveau(c.niveau);
  }

  return (
    <Card>
      <div className="font-display font-bold text-base text-ink mb-4">Scolaire — classes</div>
      <form onSubmit={handleSubmit} className="flex gap-2 items-end mb-4">
        <FormField label="Nom">
          <input className={fieldInputClass} value={nom} onChange={(e) => setNom(e.target.value)} required />
        </FormField>
        <FormField label="Niveau">
          <input className={fieldInputClass} value={niveau} onChange={(e) => setNiveau(e.target.value)} required />
        </FormField>
        <Button type="submit" className="w-auto" disabled={createClasse.isPending}>
          Ajouter
        </Button>
      </form>

      <Table>
        <thead>
          <tr>
            <Th>Nom</Th>
            <Th>Niveau</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {classes?.map((c) => {
            const isEditing = editingClasseId === c.id;
            return (
              <Fragment key={c.id}>
                <tr
                  className="cursor-pointer"
                  onClick={() => !isEditing && setSelectedClasse(selectedClasse === c.id ? null : c.id)}
                >
                  <Td>
                    {isEditing ? (
                      <input
                        className={`${fieldInputClass} !py-1 !text-xs`}
                        value={editNom}
                        onChange={(e) => setEditNom(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-ink-soft text-[10px]">{selectedClasse === c.id ? "▾" : "▸"}</span>
                        {c.nom}
                        <span className="text-ink-soft text-[11px] font-mono font-normal">(matières)</span>
                      </span>
                    )}
                  </Td>
                  <Td>
                    {isEditing ? (
                      <input
                        className={`${fieldInputClass} !py-1 !text-xs`}
                        value={editNiveau}
                        onChange={(e) => setEditNiveau(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      c.niveau
                    )}
                  </Td>
                  <Td>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateClasse.mutate({ id: c.id, data: { nom: editNom, niveau: editNiveau } });
                          }}
                          className="text-primary-deep text-xs font-mono"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingClasseId(null);
                          }}
                          className="text-ink-soft text-xs font-mono"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button type="button" onClick={(e) => startEdit(c, e)} className="text-ink-soft text-xs font-mono">
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Supprimer la classe "${c.nom}" ? Cette action est irréversible.`)) {
                              deleteClasse.mutate(c.id);
                            }
                          }}
                          className="text-alert text-xs font-mono"
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </Td>
                </tr>
                {selectedClasse === c.id && (
                  <tr>
                    <Td className="border-b-0" colSpan={3}>
                      <MatieresScolairesList classeId={c.id} />
                    </Td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

function MatieresScolairesList({ classeId }: { classeId: string }) {
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState("");

  const { data: matieres } = useQuery({
    queryKey: ["matieres-scolaires", classeId],
    queryFn: () => api.get<MatiereScolaire[]>(`/api/structure/classes/${classeId}/matieres`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["matieres-scolaires", classeId] });

  const create = useMutation({
    mutationFn: () => api.post("/api/admin/matieres-scolaires", { nom, classeId }),
    onSuccess: () => {
      setError(null);
      setNom("");
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  const update = useMutation({
    mutationFn: ({ id, nom }: { id: string; nom: string }) =>
      api.patch(`/api/admin/matieres-scolaires/${id}`, { nom }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  return (
    <div className="bg-bg rounded-[14px] p-3 mt-1">
      <div className="text-xs font-mono uppercase text-ink-soft mb-2">Matières de cette classe</div>
      <ul className="mb-2 space-y-1">
        {matieres?.map((m) => (
          <li key={m.id} className="text-sm font-semibold text-ink flex items-center gap-2">
            {editingId === m.id ? (
              <>
                <input
                  className={`${fieldInputClass} !py-1 !text-xs`}
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="text-primary-deep text-xs font-mono font-normal"
                  onClick={() => update.mutate({ id: m.id, nom: editNom })}
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="text-ink-soft text-xs font-mono font-normal"
                  onClick={() => setEditingId(null)}
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                {m.nom}
                <button
                  type="button"
                  className="text-ink-soft text-xs font-mono font-normal"
                  onClick={() => {
                    setEditingId(m.id);
                    setEditNom(m.nom);
                  }}
                >
                  Modifier
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className={fieldInputClass}
          placeholder="Nom de la matière"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
        <Button
          type="button"
          className="w-auto"
          onClick={() => create.mutate()}
          disabled={!nom.trim() || create.isPending}
        >
          Ajouter
        </Button>
      </div>
      {error && <p className="text-sm text-alert mt-2">{error}</p>}
    </div>
  );
}

function UniversitaireSection() {
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const [selectedFiliere, setSelectedFiliere] = useState<string | null>(null);
  const [editingFiliereId, setEditingFiliereId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState("");

  const { data: filieres } = useQuery({
    queryKey: ["filieres"],
    queryFn: () => api.get<Filiere[]>("/api/structure/filieres"),
  });

  const create = useMutation({
    mutationFn: () => api.post("/api/admin/filieres", { nom }),
    onSuccess: () => {
      setNom("");
      queryClient.invalidateQueries({ queryKey: ["filieres"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/filieres/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["filieres"] }),
  });
  const update = useMutation({
    mutationFn: ({ id, nom }: { id: string; nom: string }) => api.patch(`/api/admin/filieres/${id}`, { nom }),
    onSuccess: () => {
      setEditingFiliereId(null);
      queryClient.invalidateQueries({ queryKey: ["filieres"] });
    },
  });

  return (
    <Card>
      <div className="font-display font-bold text-base text-ink mb-4">Universitaire — filières</div>
      <div className="flex gap-2 items-end mb-4">
        <FormField label="Nom de la filière">
          <input className={fieldInputClass} value={nom} onChange={(e) => setNom(e.target.value)} />
        </FormField>
        <Button type="button" className="w-auto" onClick={() => create.mutate()} disabled={!nom.trim()}>
          Ajouter
        </Button>
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Nom</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {filieres?.map((f) => {
            const isEditing = editingFiliereId === f.id;
            return (
              <Fragment key={f.id}>
                <tr
                  className="cursor-pointer"
                  onClick={() => !isEditing && setSelectedFiliere(selectedFiliere === f.id ? null : f.id)}
                >
                  <Td>
                    {isEditing ? (
                      <input
                        className={`${fieldInputClass} !py-1 !text-xs`}
                        value={editNom}
                        onChange={(e) => setEditNom(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-ink-soft text-[10px]">{selectedFiliere === f.id ? "▾" : "▸"}</span>
                        {f.nom}
                        <span className="text-ink-soft text-[11px] font-mono font-normal">(niveaux)</span>
                      </span>
                    )}
                  </Td>
                  <Td>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            update.mutate({ id: f.id, nom: editNom });
                          }}
                          className="text-primary-deep text-xs font-mono"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFiliereId(null);
                          }}
                          className="text-ink-soft text-xs font-mono"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFiliereId(f.id);
                            setEditNom(f.nom);
                          }}
                          className="text-ink-soft text-xs font-mono"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Supprimer la filière "${f.nom}" ? Cette action est irréversible.`)) {
                              remove.mutate(f.id);
                            }
                          }}
                          className="text-alert text-xs font-mono"
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </Td>
                </tr>
                {selectedFiliere === f.id && (
                  <tr>
                    <Td className="border-b-0" colSpan={2}>
                      <NiveauxList filiereId={f.id} />
                    </Td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

const NIVEAU_OPTIONS = ["L1", "L2", "L3", "M1", "M2"] as const;
type NiveauValue = (typeof NIVEAU_OPTIONS)[number];

function NiveauxList({ filiereId }: { filiereId: string }) {
  const queryClient = useQueryClient();
  const [nom, setNom] = useState<NiveauValue>("L1");
  const [selectedNiveau, setSelectedNiveau] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState<NiveauValue>("L1");

  const { data: niveaux } = useQuery({
    queryKey: ["niveaux", filiereId],
    queryFn: () => api.get<NiveauUniversitaire[]>(`/api/structure/filieres/${filiereId}/niveaux`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["niveaux", filiereId] });

  const create = useMutation({
    mutationFn: () => api.post("/api/admin/niveaux-universitaires", { nom, filiereId }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, nom }: { id: string; nom: NiveauValue }) =>
      api.patch(`/api/admin/niveaux-universitaires/${id}`, { nom }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  return (
    <div className="bg-bg rounded-[14px] p-3 mt-1">
      <div className="text-xs font-mono uppercase text-ink-soft mb-2">Niveaux</div>
      <ul className="mb-2 space-y-1">
        {niveaux?.map((n) => (
          <li key={n.id} className="flex items-center gap-2">
            {editingId === n.id ? (
              <>
                <select
                  className={`${fieldInputClass} !py-1 !text-xs w-auto`}
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value as NiveauValue)}
                >
                  {NIVEAU_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-primary-deep text-xs font-mono"
                  onClick={() => update.mutate({ id: n.id, nom: editNom })}
                >
                  Enregistrer
                </button>
                <button type="button" className="text-ink-soft text-xs font-mono" onClick={() => setEditingId(null)}>
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedNiveau(selectedNiveau === n.id ? null : n.id)}
                  className="text-sm font-semibold text-ink underline inline-flex items-center gap-1"
                >
                  <span className="text-ink-soft text-[10px] no-underline">
                    {selectedNiveau === n.id ? "▾" : "▸"}
                  </span>
                  {n.nom}
                  <span className="text-ink-soft text-[11px] font-mono font-normal no-underline">(UE)</span>
                </button>
                <button
                  type="button"
                  className="text-ink-soft text-xs font-mono"
                  onClick={() => {
                    setEditingId(n.id);
                    setEditNom(n.nom as NiveauValue);
                  }}
                >
                  Modifier
                </button>
              </>
            )}
            {selectedNiveau === n.id && editingId !== n.id && <UEList niveauId={n.id} />}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <select className={fieldInputClass} value={nom} onChange={(e) => setNom(e.target.value as NiveauValue)}>
          {NIVEAU_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <Button type="button" className="w-auto" onClick={() => create.mutate()}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}

function UEList({ niveauId }: { niveauId: string }) {
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState("");

  const { data: ues } = useQuery({
    queryKey: ["ue-matieres", niveauId],
    queryFn: () => api.get<UEMatiere[]>(`/api/structure/niveaux/${niveauId}/ue-matieres`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ue-matieres", niveauId] });

  const create = useMutation({
    mutationFn: () => api.post("/api/admin/ue-matieres", { nom, niveauUniversitaireId: niveauId }),
    onSuccess: () => {
      setNom("");
      invalidate();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, nom }: { id: string; nom: string }) => api.patch(`/api/admin/ue-matieres/${id}`, { nom }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  return (
    <div className="bg-surface border border-line rounded-[10px] p-2 mt-1 ml-3">
      <div className="text-[11px] font-mono uppercase text-ink-soft mb-1">UE / matières</div>
      <ul className="mb-1 space-y-1">
        {ues?.map((ue) => (
          <li key={ue.id} className="text-xs font-semibold text-ink flex items-center gap-2">
            {editingId === ue.id ? (
              <>
                <input
                  className={`${fieldInputClass} !py-1 !text-xs`}
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="text-primary-deep font-mono font-normal"
                  onClick={() => update.mutate({ id: ue.id, nom: editNom })}
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="text-ink-soft font-mono font-normal"
                  onClick={() => setEditingId(null)}
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                {ue.nom}
                <button
                  type="button"
                  className="text-ink-soft font-mono font-normal"
                  onClick={() => {
                    setEditingId(ue.id);
                    setEditNom(ue.nom);
                  }}
                >
                  Modifier
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <input className={fieldInputClass} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" />
        <Button type="button" className="w-auto" onClick={() => create.mutate()} disabled={!nom.trim()}>
          +
        </Button>
      </div>
    </div>
  );
}
