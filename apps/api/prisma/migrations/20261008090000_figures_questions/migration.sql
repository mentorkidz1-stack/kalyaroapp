-- Figures mathématiques (chantier 2.3) : description JSON facultative sur QCM et saisie libre
-- (QuestionEpreuve.figure existe déjà). Colonnes nullables : aucune donnée existante modifiée.
-- AlterTable
ALTER TABLE "questions_qcm" ADD COLUMN     "figure" JSONB;

-- AlterTable
ALTER TABLE "questions_saisie_libre" ADD COLUMN     "figure" JSONB;

