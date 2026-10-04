import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { useAuthStore } from "../../stores/auth";
import { AppHeader } from "../../components/AppHeader";
import { Badge, Card, Button, LoadingState, EmptyState, ErrorState, MathText } from "../../design-system";
import { useStreak } from "../streak/useStreak";

interface Matiere {
  id: string;
  nom: string;
}
interface EpreuveEtudiant {
  id: string;
  enonce: string;
  annee: number | null;
  session: string | null;
  examen: string | null;
  etablissementSource: string | null;
  dureeMinutes: number | null;
  bareme: number;
  nbQuestions: number;
  decoupee: boolean;
  dernierPassage: { id: string; termineAt: string; note: number | null; bareme: number | null } | null;
}

const formatPoints = (x: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
/** Aperçu court du sujet : le texte complet s'affiche pendant le passage. */
const apercu = (texte: string) => (texte.length > 180 ? `${texte.slice(0, 180).trimEnd()}…` : texte);

export function EpreuvesListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [matiereId, setMatiereId] = useState<string | null>(null);
  const [erreurDemarrage, setErreurDemarrage] = useState<string | null>(null);

  const {
    data: matieres,
    isLoading: isLoadingMatieres,
    error: matieresError,
    refetch: refetchMatieres,
  } = useQuery({
    queryKey: ["mes-matieres", user?.classeId, user?.niveauUniversitaireId],
    queryFn: () =>
      user?.classeId
        ? api.get<Matiere[]>(`/api/structure/classes/${user.classeId}/matieres`)
        : api.get<Matiere[]>(`/api/structure/niveaux/${user!.niveauUniversitaireId}/ue-matieres`),
    enabled: !!user?.classeId || !!user?.niveauUniversitaireId,
  });

  const {
    data: epreuves,
    isLoading: isLoadingEpreuves,
    error: epreuvesError,
    refetch: refetchEpreuves,
  } = useQuery({
    queryKey: ["epreuves-eleve", matiereId],
    queryFn: () => api.get<EpreuveEtudiant[]>(`/api/eleve/matieres/${matiereId}/epreuves`),
    enabled: !!matiereId,
  });
  const { data: streakData } = useStreak();

  const demarrer = useMutation({
    mutationFn: (epreuveId: string) => api.post<{ passageId: string }>(`/api/eleve/epreuves/${epreuveId}/passages`),
    onSuccess: (p) => navigate(`/epreuves/passages/${p.passageId}`),
    onError: (err) => setErreurDemarrage(err instanceof ApiError ? err.message : "Impossible de démarrer l'épreuve."),
  });

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader title="Épreuves" subtitle="Anciens sujets d'examen" streak={streakData?.streakCount} />
      <div className="max-w-lg mx-auto p-5 space-y-4">
        {isLoadingMatieres && <LoadingState label="Chargement de tes matières…" />}
        {!isLoadingMatieres && matieresError && (
          <ErrorState message="Impossible de charger tes matières." onRetry={() => refetchMatieres()} />
        )}
        {!isLoadingMatieres && !matieresError && (matieres?.length ?? 0) === 0 && (
          <EmptyState icon="📚" message="Aucune matière disponible pour l'instant." />
        )}
        {matieres && matieres.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {matieres.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMatiereId(m.id)}
                className={`px-3 py-2 rounded-[10px] border-2 text-sm font-bold ${
                  matiereId === m.id ? "border-primary bg-primary-tint text-primary-deep" : "border-line text-ink-soft"
                }`}
              >
                {m.nom}
              </button>
            ))}
          </div>
        )}

        {erreurDemarrage && <ErrorState message={erreurDemarrage} />}

        {matiereId && (
          <div className="space-y-3">
            {isLoadingEpreuves && <LoadingState label="Chargement des épreuves…" />}
            {!isLoadingEpreuves && epreuvesError && (
              <ErrorState message="Impossible de charger les épreuves." onRetry={() => refetchEpreuves()} />
            )}
            {!isLoadingEpreuves && !epreuvesError && (epreuves?.length ?? 0) === 0 && (
              <EmptyState icon="📝" message="Aucune épreuve disponible pour cette matière pour l'instant." />
            )}
            {epreuves?.map((e) => (
              <Card key={e.id}>
                <div className="font-display font-bold text-base text-ink">{e.examen ?? "Épreuve"}</div>
                <div className="flex flex-wrap gap-1.5 my-2">
                  {[e.session, e.annee?.toString(), e.etablissementSource].filter(Boolean).map((t) => (
                    <Badge key={t} variant="manual">
                      {t}
                    </Badge>
                  ))}
                  <Badge variant="neutral">
                    {e.nbQuestions} question{e.nbQuestions > 1 ? "s" : ""} · sur {formatPoints(e.bareme)}
                  </Badge>
                  {e.dureeMinutes && <Badge variant="neutral">{e.dureeMinutes} min</Badge>}
                </div>
                <p className="text-sm text-ink-soft mb-3">
                  <MathText text={apercu(e.enonce)} />
                </p>
                {e.dernierPassage?.note != null && (
                  <p className="text-sm text-ink mb-3">
                    Ta dernière note :{" "}
                    <strong>
                      {formatPoints(e.dernierPassage.note)} / {formatPoints(e.dernierPassage.bareme ?? e.bareme)}
                    </strong>
                  </p>
                )}
                <Button
                  className="w-auto"
                  disabled={demarrer.isPending}
                  onClick={() => {
                    setErreurDemarrage(null);
                    demarrer.mutate(e.id);
                  }}
                >
                  {demarrer.isPending && demarrer.variables === e.id
                    ? "Préparation…"
                    : e.dernierPassage
                      ? "Repasser l'épreuve"
                      : "Commencer"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
