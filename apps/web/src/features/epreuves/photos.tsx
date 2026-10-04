import { useRef, useState } from "react";
import { api } from "../../lib/api-client";
import { compressImage } from "../../lib/image-compress";
import { Button } from "../../design-system";

/** Une copie manuscrite doit rester lisible : on compresse moins qu'une photo ordinaire. */
const COMPRESSION_COPIE = { maxEdge: 2000, quality: 0.8 };

/** Envoie des photos (champ multipart « photos ») et renvoie la réponse JSON de l'API. */
export async function envoyerPhotos<T>(url: string, photos: Blob[]): Promise<T> {
  const formData = new FormData();
  photos.forEach((p, i) => formData.append("photos", p, `page-${i + 1}.jpg`));
  return api.upload<T>(url, formData);
}

/**
 * Bouton « prendre en photo » : ouvre directement l'appareil photo arrière du téléphone
 * (ou la galerie), compresse chaque photo, puis la transmet au parent.
 */
export function BoutonPhotos({
  libelle,
  max,
  enCours,
  onPhotos,
  variant = "ghost",
}: {
  libelle: string;
  max: number;
  enCours: boolean;
  onPhotos: (photos: Blob[]) => void;
  variant?: "ghost" | "primary";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [preparation, setPreparation] = useState(false);

  async function surSelection(fichiers: FileList | null) {
    setErreur(null);
    const liste = Array.from(fichiers ?? []);
    if (input.current) input.current.value = ""; // permet de reprendre la même photo
    if (liste.length === 0) return;
    if (liste.length > max) {
      setErreur(`${max} photo${max > 1 ? "s" : ""} au maximum à la fois.`);
      return;
    }
    setPreparation(true);
    try {
      onPhotos(await Promise.all(liste.map((f) => compressImage(f, COMPRESSION_COPIE))));
    } catch {
      setErreur("Impossible de préparer la photo sur cet appareil. Réessaie ou choisis-la depuis la galerie.");
    } finally {
      setPreparation(false);
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => void surSelection(e.target.files)}
      />
      <Button type="button" variant={variant} disabled={enCours || preparation} onClick={() => input.current?.click()}>
        {preparation ? "Préparation de la photo…" : enCours ? "Lecture de ta copie…" : libelle}
      </Button>
      {erreur && <p className="text-xs text-alert mt-1">{erreur}</p>}
    </div>
  );
}

/** Conseils affichés avant de photographier une copie. */
export function ConseilsPhoto() {
  return (
    <p className="text-xs text-ink-soft">
      Pour une bonne lecture : copie à plat, bien éclairée, sans ombre, une page par photo, numéros des questions
      visibles (1, 2.a…).
    </p>
  );
}
