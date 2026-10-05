import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api-client";
import { AuthedImage } from "../../components/AuthedImage";
import { Button } from "../../design-system";
import { decouperZone, dessinerPage, ouvrirPdf, type DocumentPdf, type Zone } from "./pdf-pages";

/** Une question affiche au plus 4 extraits (même limite que l'API). */
const MAX_IMAGES = 4;
const messageErreur = (err: unknown) => (err instanceof ApiError ? err.message : "Erreur");

/**
 * Choix du PDF du sujet, une fois pour toute l'épreuve : il est lu dans le navigateur et
 * sert ensuite à découper des extraits pour chaque question.
 */
export function ChoixSujetPdf({ pdf, onPdf }: { pdf: { doc: DocumentPdf; nom: string } | null; onPdf: (p: { doc: DocumentPdf; nom: string } | null) => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  return (
    <div className="text-xs text-ink-soft flex items-center gap-2 flex-wrap">
      <span>Images du sujet (schémas, tableaux) :</span>
      <label className="font-mono text-primary-deep underline cursor-pointer">
        {chargement ? "Ouverture…" : pdf ? `PDF ouvert : ${pdf.nom} (${pdf.doc.numPages} p.) — changer` : "Ouvrir le PDF du sujet"}
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={async (e) => {
            const fichier = e.target.files?.[0];
            e.target.value = "";
            if (!fichier) return;
            setErreur(null);
            setChargement(true);
            try {
              onPdf({ doc: await ouvrirPdf(fichier), nom: fichier.name });
            } catch {
              setErreur("Ce PDF n'a pas pu être ouvert.");
            } finally {
              setChargement(false);
            }
          }}
        />
      </label>
      {erreur && <span className="text-alert">{erreur}</span>}
    </div>
  );
}

/** Extraits rattachés à une question enregistrée : vignettes, retrait, ajout depuis le PDF ou un fichier image. */
export function ImagesQuestion({
  questionId,
  imageUrls,
  pdf,
  queryKey,
}: {
  questionId: string;
  imageUrls: string[];
  pdf: DocumentPdf | null;
  queryKey: unknown[];
}) {
  const queryClient = useQueryClient();
  const [decoupage, setDecoupage] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const rafraichir = () => queryClient.invalidateQueries({ queryKey });

  const envoyer = useMutation({
    mutationFn: (image: Blob) => {
      const form = new FormData();
      form.append("image", image, image.type === "image/png" ? "extrait.png" : "extrait.jpg");
      return api.upload(`/api/admin/questions-epreuve/${questionId}/images`, form);
    },
    onSuccess: () => {
      setErreur(null);
      setDecoupage(false);
      rafraichir();
    },
    onError: (err) => setErreur(messageErreur(err)),
  });
  const retirer = useMutation({
    mutationFn: (cle: string) => api.delete(`/api/admin/questions-epreuve/${questionId}/images/${cle}`),
    onSuccess: rafraichir,
    onError: (err) => setErreur(messageErreur(err)),
  });

  const plein = imageUrls.length >= MAX_IMAGES;
  return (
    <div className="space-y-2">
      {imageUrls.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {imageUrls.map((cle) => (
            <div key={cle} className="relative">
              <AuthedImage
                src={`/api/admin/questions-epreuve/${questionId}/images/${cle}`}
                alt="Extrait du sujet"
                fit="contain"
                className="h-24 w-36 border border-line bg-white"
              />
              <button
                type="button"
                className="absolute top-1 right-1 bg-white/90 rounded px-1 text-[11px] font-mono text-alert"
                onClick={() => window.confirm("Retirer cette image de la question ?") && retirer.mutate(cle)}
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}
      {!plein && !decoupage && (
        <div className="flex gap-3 flex-wrap text-xs font-mono">
          {pdf && (
            <button type="button" className="text-primary-deep underline" onClick={() => setDecoupage(true)}>
              + Extrait du PDF
            </button>
          )}
          <label className="text-primary-deep underline cursor-pointer">
            {envoyer.isPending ? "Envoi…" : "+ Image (fichier)"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) envoyer.mutate(f);
              }}
            />
          </label>
        </div>
      )}
      {decoupage && pdf && (
        <DecoupeurPage
          doc={pdf}
          enCours={envoyer.isPending}
          onAnnuler={() => setDecoupage(false)}
          onExtrait={(blob) => envoyer.mutate(blob)}
        />
      )}
      {erreur && <p className="text-xs text-alert">{erreur}</p>}
    </div>
  );
}

/** Page du PDF à l'écran : l'admin encadre la zone voulue en glissant (souris ou doigt). */
function DecoupeurPage({
  doc,
  enCours,
  onAnnuler,
  onExtrait,
}: {
  doc: DocumentPdf;
  enCours: boolean;
  onAnnuler: () => void;
  onExtrait: (image: Blob) => void;
}) {
  const canevas = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [rendu, setRendu] = useState(false);
  const [debut, setDebut] = useState<{ x: number; y: number } | null>(null);
  const [zone, setZone] = useState<Zone | null>(null); // en pixels affichés (CSS)

  useEffect(() => {
    setRendu(false);
    setZone(null);
    if (!canevas.current) return;
    const dessin = dessinerPage(doc, page, canevas.current);
    dessin.fini.then((ok) => ok && setRendu(true)).catch(() => undefined); // rendu annulé : rien à faire
    return dessin.annuler;
  }, [doc, page]);

  const position = (e: React.PointerEvent) => {
    const r = canevas.current!.getBoundingClientRect();
    return { x: Math.min(Math.max(0, e.clientX - r.left), r.width), y: Math.min(Math.max(0, e.clientY - r.top), r.height) };
  };
  const etendre = (p: { x: number; y: number }) =>
    debut && setZone({ x: Math.min(debut.x, p.x), y: Math.min(debut.y, p.y), largeur: Math.abs(p.x - debut.x), hauteur: Math.abs(p.y - debut.y) });

  async function valider() {
    const c = canevas.current;
    if (!c || !zone) return;
    // Pixels affichés → pixels du canevas (rendu en haute résolution).
    const k = c.width / c.getBoundingClientRect().width;
    onExtrait(await decouperZone(c, { x: zone.x * k, y: zone.y * k, largeur: zone.largeur * k, hauteur: zone.hauteur * k }));
  }

  const zoneValide = !!zone && zone.largeur > 12 && zone.hauteur > 12;
  return (
    <div className="border border-line rounded-[10px] p-2 space-y-2 bg-bg">
      <div className="flex items-center gap-3 text-xs font-mono">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Page précédente">
          ←
        </button>
        <span>
          Page {page} / {doc.numPages}
        </span>
        <button type="button" disabled={page >= doc.numPages} onClick={() => setPage((p) => p + 1)} aria-label="Page suivante">
          →
        </button>
        <span className="text-ink-soft">Encadrez la zone à garder en glissant sur la page.</span>
      </div>
      <div className="relative max-h-[70vh] overflow-auto border border-line bg-white">
        <div className="relative" style={{ touchAction: "none" }}>
          <canvas
            ref={canevas}
            className="block w-full h-auto cursor-crosshair select-none"
            onPointerDown={(e) => {
              try {
                e.currentTarget.setPointerCapture(e.pointerId); // la sélection suit le doigt même hors du canevas
              } catch {
                // pointeur déjà relâché : la sélection fonctionne sans capture
              }
              const p = position(e);
              setDebut(p);
              setZone({ ...p, largeur: 0, hauteur: 0 });
            }}
            onPointerMove={(e) => debut && etendre(position(e))}
            onPointerUp={(e) => {
              etendre(position(e));
              setDebut(null);
            }}
          />
          {zone && (
            <div
              className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
              style={{ left: zone.x, top: zone.y, width: zone.largeur, height: zone.hauteur }}
            />
          )}
          {!rendu && <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-soft">Affichage de la page…</div>}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" className="w-auto" disabled={!zoneValide || enCours} onClick={valider}>
          {enCours ? "Envoi…" : "Ajouter cet extrait"}
        </Button>
        <Button type="button" variant="ghost" className="w-auto" onClick={onAnnuler}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
