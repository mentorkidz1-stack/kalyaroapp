import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { SessionUser } from "@kalyaro/shared";
import { api, ApiError } from "../../lib/api-client";
import { useAuthStore } from "../../stores/auth";
import { Button, Card, BrandMark, FeedbackBlock } from "../../design-system";

interface Classe {
  id: string;
  nom: string;
  niveau: string;
}
interface Filiere {
  id: string;
  nom: string;
}
interface NiveauUniversitaire {
  id: string;
  nom: string;
  filiereId: string;
}

type Mode = "login" | "register";
type TypeParcours = "SCOLAIRE" | "UNIVERSITAIRE";

const inputClass =
  "w-full px-4 py-3 rounded-[14px] border-2 border-line font-sans text-sm focus:outline-none focus:border-primary";

export function ConnexionPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [typeParcours, setTypeParcours] = useState<TypeParcours>("SCOLAIRE");
  const [classeId, setClasseId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    data: classes,
    error: classesError,
    isLoading: classesLoading,
  } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<Classe[]>("/api/structure/classes"),
    enabled: mode === "register" && typeParcours === "SCOLAIRE",
  });
  const {
    data: filieres,
    error: filieresError,
    isLoading: filieresLoading,
  } = useQuery({
    queryKey: ["filieres"],
    queryFn: () => api.get<Filiere[]>("/api/structure/filieres"),
    enabled: mode === "register" && typeParcours === "UNIVERSITAIRE",
  });
  const {
    data: niveaux,
    error: niveauxError,
    isLoading: niveauxLoading,
  } = useQuery({
    queryKey: ["niveaux", filiereId],
    queryFn: () => api.get<NiveauUniversitaire[]>(`/api/structure/filieres/${filiereId}/niveaux`),
    enabled: !!filiereId,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === "login"
          ? await api.post<{ token: string; user: SessionUser }>("/api/auth/login", { email, password })
          : await api.post<{ token: string; user: SessionUser }>("/api/auth/register", {
              email,
              password,
              nom,
              typeParcours,
              ...(typeParcours === "SCOLAIRE" ? { classeId } : { niveauUniversitaireId: niveauId }),
            });
      setSession(result.token, result.user);
      navigate(result.user.role === "ADMIN" ? "/admin" : "/cours");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <div className="flex items-center gap-3 mb-6">
          <BrandMark />
          <div className="font-display font-extrabold text-xl text-ink">Kalyaro</div>
        </div>

        <div className="flex gap-2 bg-bg border border-line rounded-[14px] p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-2 rounded-[10px] font-sans font-bold text-sm transition-colors ${
              mode === "login" ? "bg-primary text-white" : "text-ink-soft"
            }`}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 py-2 rounded-[10px] font-sans font-bold text-sm transition-colors ${
              mode === "register" ? "bg-primary text-white" : "text-ink-soft"
            }`}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <input
              required
              placeholder="Nom complet"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className={inputClass}
            />
          )}
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <input
            required
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />

          {mode === "register" && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTypeParcours("SCOLAIRE")}
                  className={`flex-1 py-2 rounded-[10px] border-2 font-sans font-bold text-sm transition-colors ${
                    typeParcours === "SCOLAIRE"
                      ? "border-primary bg-primary-tint text-primary-deep"
                      : "border-line text-ink-soft"
                  }`}
                >
                  Scolaire
                </button>
                <button
                  type="button"
                  onClick={() => setTypeParcours("UNIVERSITAIRE")}
                  className={`flex-1 py-2 rounded-[10px] border-2 font-sans font-bold text-sm transition-colors ${
                    typeParcours === "UNIVERSITAIRE"
                      ? "border-accent bg-accent-tint text-[#8A5A0E]"
                      : "border-line text-ink-soft"
                  }`}
                >
                  Universitaire
                </button>
              </div>

              {typeParcours === "SCOLAIRE" ? (
                <>
                  <select required value={classeId} onChange={(e) => setClasseId(e.target.value)} className={inputClass}>
                    <option value="">Choisis ta classe</option>
                    {classes?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                  {classesError && (
                    <p className="text-xs text-alert">Impossible de charger les classes. Réessaie dans un instant.</p>
                  )}
                  {!classesLoading && !classesError && (classes?.length ?? 0) === 0 && (
                    <p className="text-xs text-ink-soft">Aucune classe n'est encore configurée.</p>
                  )}
                </>
              ) : (
                <>
                  <select
                    required
                    value={filiereId}
                    onChange={(e) => {
                      setFiliereId(e.target.value);
                      setNiveauId("");
                    }}
                    className={inputClass}
                  >
                    <option value="">Choisis ta filière</option>
                    {filieres?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nom}
                      </option>
                    ))}
                  </select>
                  {filieresError && (
                    <p className="text-xs text-alert">Impossible de charger les filières. Réessaie dans un instant.</p>
                  )}
                  {!filieresLoading && !filieresError && (filieres?.length ?? 0) === 0 && (
                    <p className="text-xs text-ink-soft">Aucune filière n'est encore configurée.</p>
                  )}
                  {filiereId && (
                    <>
                      <select
                        required
                        value={niveauId}
                        onChange={(e) => setNiveauId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Choisis ton niveau</option>
                        {niveaux?.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.nom}
                          </option>
                        ))}
                      </select>
                      {niveauxError && (
                        <p className="text-xs text-alert">Impossible de charger les niveaux. Réessaie dans un instant.</p>
                      )}
                      {!niveauxLoading && !niveauxError && (niveaux?.length ?? 0) === 0 && (
                        <p className="text-xs text-ink-soft">Aucun niveau n'est encore configuré pour cette filière.</p>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {error && <FeedbackBlock variant="warn">{error}</FeedbackBlock>}

          <Button type="submit" disabled={loading}>
            {loading ? "Un instant…" : mode === "login" ? "Se connecter" : "Continuer"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
