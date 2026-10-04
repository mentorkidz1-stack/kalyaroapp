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
  dureeExamenMinutes: number;
  bareme: number;
  nbQuestions: number;
  decoupee: boolean;
  dernierPassage: {
    id: string;
    mode: "ENTRAINEMENT" | "EXAMEN_BLANC";
    termineAt: string;
    note: number | null;
    bareme: number | null;
  } | null;
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
    mutationFn: ({ epreuveId, mode }: { epreuveId: string; mode: "ENTRAINEMENT" | "EXAMEN_BLANC" }) =>
      api.post<{ passageId: string; mode: string }>(`/api/eleve/epreuves/${epreuveId}/passages`, { mode }),
    onSuccess: (p) =>
      navigate(p.mode === "EXAMEN_BLANC" ? `/epreuves/examen/${p.passageId}` : `/epreuves/passages/${p.passageId}`),
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
                  <Badge variant="neutral">{e.dureeExamenMinutes} min</Badge>
                </div>
                <p className="text-sm text-ink-soft mb-3">
                  <MathText text={apercu(e.enonce)} />
                </p>
                {e.dernierPassage?.note != null && (
                  <p className="text-sm text-ink mb-3">
                    {e.dernierPassage.mode === "EXAMEN_BLANC" ? "Dernier examen blanc" : "Dernier entraînement"} :{" "}
                    <strong>
                      {formatPoints(e.dernierPassage.note)} / {formatPoints(e.dernierPassage.bareme ?? e.bareme)}
                    </strong>
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="ghost"
                    disabled={demarrer.isPending}
                    onClick={() => {
                      setErreurDemarrage(null);
                      demarrer.mutate({ epreuveId: e.id, mode: "ENTRAINEMENT" });
                    }}
                  >
                    {demarrer.isPending && demarrer.variables?.epreuveId === e.id && demarrer.variables.mode === "ENTRAINEMENT"
                      ? "Préparation…"
                      : "S'entraîner"}
                  </Button>
                  <Button
                    disabled={demarrer.isPending}
                    onClick={() => {
                      setErreurDemarrage(null);
                      const ok = window.confirm(
                        `Examen blanc : ${e.dureeExamenMinutes} minutes chronométrées, sans correction ni indice avant la fin. ` +
                          "Le chronomètre démarre dès maintenant. Commencer ?"
                      );
                      if (ok) demarrer.mutate({ epreuveId: e.id, mode: "EXAMEN_BLANC" });
                    }}
                  >
                    {demarrer.isPending && demarrer.variables?.epreuveId === e.id && demarrer.variables.mode === "EXAMEN_BLANC"
                      ? "Préparation…"
                      : `Examen blanc · ${e.dureeExamenMinutes} min`}
                  </Button>
                </div>
                <p className="text-xs text-ink-soft mt-2">
                  Entraînement : correction après chaque question. Examen blanc : conditions réelles, note à la fin.
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
