-- Réponses sur figure (chantier 2.4) : type de réponse des QCM (CHOIX par défaut pour
-- toutes les questions existantes) et réponse attendue. Aucune donnée existante modifiée.
-- CreateEnum
CREATE TYPE "TypeReponseQcm" AS ENUM ('CHOIX', 'PLACER_POINT', 'LIRE_VALEUR');

-- AlterTable
ALTER TABLE "questions_qcm" ADD COLUMN     "reponse_attendue" JSONB,
ADD COLUMN     "type_reponse" "TypeReponseQcm" NOT NULL DEFAULT 'CHOIX';

