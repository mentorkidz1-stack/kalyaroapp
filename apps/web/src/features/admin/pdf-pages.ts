import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

export type DocumentPdf = PDFDocumentProxy;

// pdf.js pèse lourd : chargé seulement quand un admin ouvre un sujet, jamais côté étudiant.
let chargement: Promise<typeof import("pdfjs-dist")> | null = null;
function chargerPdfjs() {
  chargement ??= Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(
    ([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    }
  );
  return chargement;
}

/** Ouvre un PDF choisi par l'admin, entièrement dans le navigateur (rien n'est envoyé). */
export async function ouvrirPdf(fichier: File): Promise<DocumentPdf> {
  const pdfjs = await chargerPdfjs();
  return pdfjs.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()) }).promise;
}

/**
 * Dessine une page dans le canevas, à une résolution assez fine pour un extrait lisible.
 * Annulable : pdf.js refuse deux rendus simultanés sur un même canevas (changement de page
 * rapide, double effet du mode strict de React).
 */
export function dessinerPage(doc: DocumentPdf, numero: number, canevas: HTMLCanvasElement, echelle = 2) {
  let annule = false;
  let tache: RenderTask | null = null;
  const fini = (async () => {
    const page = await doc.getPage(numero);
    if (annule) return false;
    const vue = page.getViewport({ scale: echelle });
    canevas.width = Math.floor(vue.width);
    canevas.height = Math.floor(vue.height);
    const ctx = canevas.getContext("2d");
    if (!ctx) throw new Error("Canevas indisponible");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canevas.width, canevas.height);
    tache = page.render({ canvasContext: ctx, viewport: vue });
    await tache.promise;
    return !annule;
  })();
  return {
    fini,
    annuler: () => {
      annule = true;
      tache?.cancel();
    },
  };
}

export interface Zone {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Largeur maximale d'un extrait : nette sur un téléphone, légère à télécharger. */
const LARGEUR_MAX_EXTRAIT = 1400;

/** Découpe une zone (en pixels du canevas) et la compresse en JPEG. */
export function decouperZone(canevas: HTMLCanvasElement, zone: Zone): Promise<Blob> {
  const ratio = Math.min(1, LARGEUR_MAX_EXTRAIT / zone.largeur);
  const sortie = document.createElement("canvas");
  sortie.width = Math.max(1, Math.round(zone.largeur * ratio));
  sortie.height = Math.max(1, Math.round(zone.hauteur * ratio));
  const ctx = sortie.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canevas indisponible"));
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, sortie.width, sortie.height);
  ctx.drawImage(canevas, zone.x, zone.y, zone.largeur, zone.hauteur, 0, 0, sortie.width, sortie.height);
  return new Promise((resolve, reject) =>
    sortie.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression impossible"))), "image/jpeg", 0.88)
  );
}
