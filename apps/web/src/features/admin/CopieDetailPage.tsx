import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { formatMathText } from "../../lib/format-math";
import { PhotoGallery } from "../../components/PhotoGallery";
import { Card, Button, Badge, FormField, fieldInputClass, Spinner } from "../../design-system";

interface CopieDetail {
  id: string;
  statut: "EN_COURS" | "SOUMIS" | "CORRIGE";
  reponseDonnee: string | null;
  reponsePhotoUrls: string[];
  soumisAt: string | null;
  horsDelai: boolean;
  noteObtenue: number | null;
  commentaireAdmin: string | null;
  pointsForts: string[];
  pointsATravailler: string[];
  evaluation: { titre: string; enonce: string | null; contenuExtrait: string | null; bareme: number };
  eleve: { nom: string };
}

function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function CopieDetailPage() {
  const { copieId } = useParams<{ copieId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noteObtenue, setNoteObtenue] = useState("");
  const [commentaireAdmin, setCommentaireAdmin] = useState("");
  const [pointsFortsText, setPointsFortsText] = useState("");
  const [pointsATravaillerText, setPointsATravaillerText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: copie, isLoading } = useQuery({
    queryKey: ["copie-admin", copieId],
    queryFn: () => api.get<CopieDetail>(`/api/admin/copies/${copieId}`),
    enabled: !!copieId,
  });

  const corriger = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/copies/${copieId}/corriger`, {
        noteObtenue: Number(noteObtenue),
        commentaireAdmin: commentaireAdmin || undefined,
        pointsForts: linesToList(pointsFortsText),
        pointsATravailler: linesToList(pointsATravaillerText),
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["copie-admin", copieId] });
      queryClient.invalidateQueries({ queryKey: ["copies-a-corriger"] });
      queryClient.invalidateQueries({ queryKey: ["copies-corrigees"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const genererFeedback = useMutation({
    mutationFn: () =>
      api.post<{ pointsForts: string[]; pointsATravailler: string[] }>(
        `/api/admin/copies/${copieId}/generer-feedback-ia`,
        {
          noteObtenue: Number(noteObtenue),
          indicationAdmin: commentaireAdmin || undefined,
        }
      ),
    onSuccess: (data) => {
      setError(null);
      setPointsFortsText(data.pointsForts.join("\n"));
      setPointsATravaillerText(data.pointsATravailler.join("\n"));
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  if (isLoading) return <Spinner />;
  if (!copie) return null;

  const enonce = copie.evaluation.enonce ?? copie.evaluation.contenuExtrait;

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate("/admin/copies")} className="text-sm text-ink-soft underline">
        ← Retour
      </button>
      <h1 className="font-display font-extrabold text-xl text-ink">{copie.evaluation.titre}</h1>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-ink">{copie.eleve.nom}</span>
          <Badge variant={copie.statut === "CORRIGE" ? "ok" : "warn"}>{copie.statut}</Badge>
          {copie.horsDelai && <Badge variant="warn">Hors délai</Badge>}
        </div>
        {enonce && (
          <div className="mb-4">
            <div className="text-xs font-mono uppercase text-ink-soft mb-1">Énoncé</div>
            <p className="text-sm text-ink whitespace-pre-wrap">{formatMathText(enonce)}</p>
          </div>
        )}
        {copie.reponseDonnee && (
          <div>
            <div className="text-xs font-mono uppercase text-ink-soft mb-1">Réponse de l'élève</div>
            <p className="text-sm text-ink whitespace-pre-wrap">{copie.reponseDonnee}</p>
          </div>
        )}
        {copie.reponsePhotoUrls.length > 0 && (
          <div className={copie.reponseDonnee ? "mt-4" : ""}>
            <div className="text-xs font-mono uppercase text-ink-soft mb-1">Photos de la réponse</div>
            <PhotoGallery
              srcs={copie.reponsePhotoUrls.map((_, i) => `/api/admin/copies/${copieId}/photo/${i}`)}
              altPrefix="Photo de la réponse"
            />
          </div>
        )}
      </Card>

      {copie.statut === "SOUMIS" && (
        <Card>
          <div className="font-display font-bold text-base text-ink mb-3">Noter</div>
          <div className="flex gap-2 items-end mb-2">
            <FormField label={`Note (sur ${copie.evaluation.bareme})`}>
              <input
                type="number"
                min={0}
                max={copie.evaluation.bareme}
                className={fieldInputClass}
                value={noteObtenue}
                onChange={(e) => setNoteObtenue(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Commentaire (optionnel)">
            <textarea
              className={`${fieldInputClass} min-h-[60px]`}
              value={commentaireAdmin}
              onChange={(e) => setCommentaireAdmin(e.target.value)}
            />
          </FormField>

          <div className="my-3">
            <Button
              type="button"
              variant="ghost"
              className="w-auto"
              onClick={() => genererFeedback.mutate()}
              disabled={!noteObtenue.trim() || !copie.reponseDonnee || genererFeedback.isPending}
            >
              {genererFeedback.isPending ? "Génération…" : "Générer un feedback IA"}
            </Button>
            {!copie.reponseDonnee && (
              <p className="text-xs text-ink-soft mt-1">
                Feedback IA indisponible : cette copie n'a pas de réponse texte.
              </p>
            )}
          </div>

          <FormField label="Points forts (un par ligne)">
            <textarea
              className={`${fieldInputClass} min-h-[80px]`}
              value={pointsFortsText}
              onChange={(e) => setPointsFortsText(e.target.value)}
            />
          </FormField>
          <FormField label="Points à travailler (un par ligne)">
            <textarea
              className={`${fieldInputClass} min-h-[80px]`}
              value={pointsATravaillerText}
              onChange={(e) => setPointsATravaillerText(e.target.value)}
            />
          </FormField>

          {error && <p className="text-sm text-alert mt-2">{error}</p>}
          <div className="mt-3">
            <Button
              type="button"
              className="w-auto"
              onClick={() => corriger.mutate()}
              disabled={!noteObtenue.trim() || corriger.isPending}
            >
              {corriger.isPending ? "Enregistrement…" : "Enregistrer la note"}
            </Button>
          </div>
        </Card>
      )}

      {copie.statut === "CORRIGE" && (
        <Card>
          <p className="text-lg font-display font-bold text-ink">
            Note : {copie.noteObtenue} / {copie.evaluation.bareme}
          </p>
          {copie.commentaireAdmin && (
            <p className="text-sm text-ink-soft mt-2">{formatMathText(copie.commentaireAdmin)}</p>
          )}
          {copie.pointsForts.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-mono uppercase text-ink-soft mb-1">Points forts</div>
              <ul className="text-sm text-ink-soft list-disc list-inside">
                {copie.pointsForts.map((point, i) => (
                  <li key={i}>{formatMathText(point)}</li>
                ))}
              </ul>
            </div>
          )}
          {copie.pointsATravailler.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-mono uppercase text-ink-soft mb-1">Points à travailler</div>
              <ul className="text-sm text-ink-soft list-disc list-inside">
                {copie.pointsATravailler.map((point, i) => (
                  <li key={i}>{formatMathText(point)}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
