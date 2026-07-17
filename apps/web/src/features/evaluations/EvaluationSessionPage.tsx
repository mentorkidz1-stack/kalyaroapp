import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { compressImage } from "../../lib/image-compress";
import { formatMathText } from "../../lib/format-math";
import { AppHeader } from "../../components/AppHeader";
import { AuthedPdfFrame } from "../../components/AuthedPdfFrame";
import { Button, Card, LoadingState, ErrorState } from "../../design-system";

const MAX_PHOTOS = 5;

interface CopieResponse {
  copieId: string;
  statut: "EN_COURS" | "SOUMIS" | "CORRIGE";
  dateLimiteAt: string;
  reponseDonnee: string | null;
  reponsePhotoUrls: string[];
  horsDelai: boolean;
  noteObtenue: number | null;
  commentaireAdmin: string | null;
  evaluation: { id: string; titre: string; enonce: string | null; aUnPdf: boolean; dureeMinutes: number; bareme: number };
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function EvaluationSessionPage() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const navigate = useNavigate();
  const [reponse, setReponse] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const hasAutoSubmittedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f));
    setPhotoUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setPhotos((prev) => {
      const next = [...prev, ...files];
      if (next.length > MAX_PHOTOS) {
        setPhotoError(`Maximum ${MAX_PHOTOS} photos par copie.`);
        return next.slice(0, MAX_PHOTOS);
      }
      setPhotoError(null);
      return next;
    });
  }

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoError(null);
  }

  const demarrer = useMutation({
    mutationFn: () => api.post<CopieResponse>(`/api/eleve/evaluations/${evaluationId}/demarrer`, {}),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });
  const demarrerMutate = demarrer.mutate;

  useEffect(() => {
    if (evaluationId) demarrerMutate();
  }, [evaluationId, demarrerMutate]);

  const copie = demarrer.data;

  const soumettre = useMutation({
    mutationFn: async (copieId: string) => {
      const formData = new FormData();
      formData.append("reponseDonnee", reponse);
      for (const [i, photo] of photos.entries()) {
        const blob = await compressImage(photo);
        formData.append("photos", blob, `photo-${i}.jpg`);
      }
      return api.upload<CopieResponse>(`/api/eleve/copies/${copieId}/soumettre`, formData);
    },
    onSuccess: (data) => navigate(`/evaluations/copie/${data.copieId}`, { replace: true }),
    onError: () => {
      hasAutoSubmittedRef.current = false;
      setSubmitError("Ta réponse n'a pas pu être envoyée. Ta saisie est conservée — réessaie.");
    },
  });
  const soumettreMutate = soumettre.mutate;

  useEffect(() => {
    if (!copie) return;
    const copieId = copie.copieId;
    const dateLimite = new Date(copie.dateLimiteAt).getTime();

    function tick() {
      const remaining = dateLimite - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0 && !hasAutoSubmittedRef.current) {
        hasAutoSubmittedRef.current = true;
        soumettreMutate(copieId);
      }
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [copie, soumettreMutate]);

  if (!evaluationId) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader title="Évaluation" subtitle="Kalyaro" onBack={() => navigate("/evaluations")} />
        <div className="max-w-lg mx-auto p-5">
          <Card className="py-4">
            <ErrorState message={error} />
            <div className="mt-2 text-center">
              <Button variant="ghost" onClick={() => navigate("/evaluations")}>
                Retour aux évaluations
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (demarrer.isPending || !copie) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader title="Évaluation" subtitle="Kalyaro" />
        <div className="max-w-lg mx-auto p-5">
          <LoadingState label="Préparation de l'évaluation…" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader
        title={copie.evaluation.titre}
        subtitle={`Temps restant : ${formatRemaining(remainingMs ?? 0)}`}
        variant="deep"
      />
      <div className="max-w-lg mx-auto p-5">
        <Card>
          {copie.evaluation.enonce && (
            <h3 className="font-display text-[17px] leading-snug text-ink mb-4 whitespace-pre-wrap">
              {formatMathText(copie.evaluation.enonce)}
            </h3>
          )}
          {copie.evaluation.aUnPdf && (
            <AuthedPdfFrame src={`/api/eleve/evaluations/${copie.evaluation.id}/pdf`} />
          )}
          <textarea
            value={reponse}
            onChange={(e) => setReponse(e.target.value)}
            placeholder="Écris ta réponse ici…"
            className="w-full min-h-[220px] rounded-[14px] border-2 border-line p-3 font-sans text-sm focus:outline-none focus:border-primary mb-3"
          />

          <div className="mb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleAddPhotos}
              className="hidden"
            />
            <Button type="button" variant="ghost" className="w-auto" onClick={() => fileInputRef.current?.click()}>
              Ajouter une photo
            </Button>
            {photoError && <p className="text-xs text-alert mt-1">{photoError}</p>}
            {photoUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {photoUrls.map((url, i) => (
                  <div key={url} className="relative w-16 h-16">
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-16 h-16 object-cover rounded-[10px] border border-line"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(i)}
                      aria-label="Supprimer la photo"
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-alert text-white text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => soumettreMutate(copie.copieId)}
              disabled={(!reponse.trim() && photos.length === 0) || soumettre.isPending}
            >
              {soumettre.isPending ? "Envoi…" : "Soumettre"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={soumettre.isPending}
              onClick={() => {
                const message =
                  reponse.trim() || photos.length > 0
                    ? "Terminer maintenant ? Ta réponse actuelle sera envoyée telle quelle et tu ne pourras plus la modifier."
                    : "Tu n'as encore rien répondu — une copie vide sera envoyée et tu ne pourras plus la modifier.";
                if (window.confirm(message)) soumettreMutate(copie.copieId);
              }}
            >
              {soumettre.isPending ? "Envoi…" : "Terminer"}
            </Button>
          </div>
          {submitError && (
            <div className="mt-3">
              <ErrorState message={submitError} onRetry={() => soumettreMutate(copie.copieId)} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
