import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { Card, Button, Badge, Table, Th, Td, FormField, fieldInputClass, Spinner } from "../../design-system";

type Role = "ADMIN" | "ELEVE" | "ETUDIANT";

interface UserRow {
  id: string;
  email: string;
  nom: string;
  role: Role;
  actif: boolean;
  classe: { nom: string } | null;
  niveauUniversitaire: { nom: string; filiere: { nom: string } } | null;
}

const ROLE_LABELS: Record<Role, string> = { ADMIN: "Admin", ELEVE: "Élève", ETUDIANT: "Étudiant" };

export function UtilisateursPage() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role | "">("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (q.trim()) params.set("q", q.trim());
  const queryString = params.toString();

  const { data: users, isLoading } = useQuery({
    queryKey: ["users", role, q],
    queryFn: () => api.get<UserRow[]>(`/api/admin/users${queryString ? `?${queryString}` : ""}`),
  });

  const toggleActif = useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) => api.patch(`/api/admin/users/${id}`, { actif }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  function handleToggle(user: UserRow) {
    const action = user.actif ? "désactiver" : "réactiver";
    if (!window.confirm(`Confirmes-tu vouloir ${action} le compte de ${user.nom} ?`)) return;
    toggleActif.mutate({ id: user.id, actif: !user.actif });
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display font-extrabold text-xl text-ink">Comptes utilisateurs</h1>

      <Card>
        <div className="flex gap-2 items-end flex-wrap">
          <FormField label="Rôle">
            <select className={fieldInputClass} value={role} onChange={(e) => setRole(e.target.value as Role | "")}>
              <option value="">Tous</option>
              <option value="ADMIN">Admin</option>
              <option value="ELEVE">Élève</option>
              <option value="ETUDIANT">Étudiant</option>
            </select>
          </FormField>
          <FormField label="Recherche (nom ou email)">
            <input className={fieldInputClass} value={q} onChange={(e) => setQ(e.target.value)} />
          </FormField>
        </div>
      </Card>

      <Card>
        {isLoading && <Spinner />}
        {error && <p className="text-sm text-alert mb-2">{error}</p>}
        {!isLoading && (
          <Table>
            <thead>
              <tr>
                <Th>Nom</Th>
                <Th>Email</Th>
                <Th>Rôle</Th>
                <Th>Classe / Niveau</Th>
                <Th>Statut</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id}>
                  <Td>{u.nom}</Td>
                  <Td>{u.email}</Td>
                  <Td>{ROLE_LABELS[u.role]}</Td>
                  <Td>{u.classe?.nom ?? (u.niveauUniversitaire ? `${u.niveauUniversitaire.filiere.nom} · ${u.niveauUniversitaire.nom}` : "—")}</Td>
                  <Td>
                    <Badge variant={u.actif ? "ok" : "warn"}>{u.actif ? "Actif" : "Désactivé"}</Badge>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      className={`text-xs font-mono ${u.actif ? "text-alert" : "text-primary-deep"}`}
                      onClick={() => handleToggle(u)}
                      disabled={toggleActif.isPending}
                    >
                      {u.actif ? "Désactiver" : "Réactiver"}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {!isLoading && (users?.length ?? 0) === 0 && (
          <p className="text-sm text-ink-soft mt-2">Aucun compte ne correspond à ces filtres.</p>
        )}
      </Card>

      <CreateAdminForm />
    </div>
  );
}

function CreateAdminForm() {
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const create = useMutation({
    mutationFn: () => api.post("/api/auth/admins", { nom, email, password }),
    onSuccess: () => {
      setError(null);
      setSuccess(true);
      setNom("");
      setEmail("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => {
      setSuccess(false);
      setError(err instanceof ApiError ? err.message : "Erreur");
    },
  });

  return (
    <Card>
      <div className="font-display font-bold text-base text-ink mb-3">Créer un compte admin</div>
      <div className="flex gap-2 items-end flex-wrap">
        <FormField label="Nom">
          <input className={fieldInputClass} value={nom} onChange={(e) => setNom(e.target.value)} />
        </FormField>
        <FormField label="Email">
          <input type="email" className={fieldInputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Mot de passe">
          <input
            type="password"
            className={fieldInputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <Button
          type="button"
          className="w-auto"
          onClick={() => create.mutate()}
          disabled={!nom.trim() || !email.trim() || !password.trim() || create.isPending}
        >
          {create.isPending ? "Création…" : "Créer"}
        </Button>
      </div>
      {error && <p className="text-sm text-alert mt-2">{error}</p>}
      {success && <p className="text-sm text-primary-deep mt-2">Compte admin créé.</p>}
    </Card>
  );
}
