-- CreateEnum
CREATE TYPE "TypeErreur" AS ENUM ('CONNAISSANCE', 'CONFUSION', 'PROCEDURE', 'LECTURE_ENONCE', 'CALCUL', 'METHODE', 'REDACTION');

-- AlterTable
ALTER TABLE "tentatives_eleve" ADD COLUMN     "erreur_corrigee_at" TIMESTAMP(3),
ADD COLUMN     "explication_erreur" TEXT,
ADD COLUMN     "type_erreur" "TypeErreur";

-- CreateIndex
CREATE INDEX "tentatives_eleve_eleve_id_correcte_idx" ON "tentatives_eleve"("eleve_id", "correcte");

