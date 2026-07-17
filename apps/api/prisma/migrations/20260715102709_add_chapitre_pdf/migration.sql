-- AlterTable
ALTER TABLE "chapitres" ADD COLUMN     "contenu_extrait" TEXT,
ADD COLUMN     "fichier_pdf_url" TEXT,
ADD COLUMN     "statut_extraction" "StatutExtraction";
