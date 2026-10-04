-- Copie papier photographiée : photos et transcription IA sur les passages et les tentatives.
-- Colonnes avec valeur par défaut : aucune donnée existante modifiée.
-- AlterTable
ALTER TABLE "passages_epreuve" ADD COLUMN     "copie_papier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photos_copie" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "transcription_copie" JSONB;

-- AlterTable
ALTER TABLE "tentatives_eleve" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];

