-- Épreuves découpées par question (chantier 2.1) : métadonnées facultatives sur epreuves,
-- questions, corrigés par question, passages, points sur les tentatives.
-- Purement additive : aucune donnée existante modifiée ; une épreuve sans question reste
-- utilisable comme question unique.
-- CreateEnum
CREATE TYPE "ModePassage" AS ENUM ('ENTRAINEMENT', 'EXAMEN_BLANC');

-- AlterTable
ALTER TABLE "epreuves" ADD COLUMN     "annee" INTEGER,
ADD COLUMN     "bareme" DOUBLE PRECISION,
ADD COLUMN     "duree_minutes" INTEGER,
ADD COLUMN     "etablissement_source" TEXT,
ADD COLUMN     "examen" TEXT,
ADD COLUMN     "session" TEXT;

-- AlterTable
ALTER TABLE "tentatives_eleve" ADD COLUMN     "passage_id" TEXT,
ADD COLUMN     "points_max" DOUBLE PRECISION,
ADD COLUMN     "points_obtenus" DOUBLE PRECISION,
ADD COLUMN     "question_epreuve_id" TEXT;

-- CreateTable
CREATE TABLE "questions_epreuve" (
    "id" TEXT NOT NULL,
    "epreuve_id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "enonce" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "notion_id" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "figure" JSONB,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_epreuve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corriges_questions_epreuve" (
    "id" TEXT NOT NULL,
    "question_epreuve_id" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "est_principal" BOOLEAN NOT NULL DEFAULT true,
    "statut_validation" "StatutValidation" NOT NULL DEFAULT 'A_VALIDER',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corriges_questions_epreuve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passages_epreuve" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "epreuve_id" TEXT NOT NULL,
    "mode" "ModePassage" NOT NULL DEFAULT 'ENTRAINEMENT',
    "demarre_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termine_at" TIMESTAMP(3),
    "points_obtenus" DOUBLE PRECISION,
    "bareme" DOUBLE PRECISION,

    CONSTRAINT "passages_epreuve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_epreuve_epreuve_id_idx" ON "questions_epreuve"("epreuve_id");

-- CreateIndex
CREATE INDEX "corriges_questions_epreuve_question_epreuve_id_idx" ON "corriges_questions_epreuve"("question_epreuve_id");

-- CreateIndex
CREATE INDEX "passages_epreuve_eleve_id_epreuve_id_idx" ON "passages_epreuve"("eleve_id", "epreuve_id");

-- CreateIndex
CREATE INDEX "tentatives_eleve_passage_id_idx" ON "tentatives_eleve"("passage_id");

-- AddForeignKey
ALTER TABLE "questions_epreuve" ADD CONSTRAINT "questions_epreuve_epreuve_id_fkey" FOREIGN KEY ("epreuve_id") REFERENCES "epreuves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_epreuve" ADD CONSTRAINT "questions_epreuve_notion_id_fkey" FOREIGN KEY ("notion_id") REFERENCES "notions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corriges_questions_epreuve" ADD CONSTRAINT "corriges_questions_epreuve_question_epreuve_id_fkey" FOREIGN KEY ("question_epreuve_id") REFERENCES "questions_epreuve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corriges_questions_epreuve" ADD CONSTRAINT "corriges_questions_epreuve_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passages_epreuve" ADD CONSTRAINT "passages_epreuve_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passages_epreuve" ADD CONSTRAINT "passages_epreuve_epreuve_id_fkey" FOREIGN KEY ("epreuve_id") REFERENCES "epreuves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentatives_eleve" ADD CONSTRAINT "tentatives_eleve_question_epreuve_id_fkey" FOREIGN KEY ("question_epreuve_id") REFERENCES "questions_epreuve"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentatives_eleve" ADD CONSTRAINT "tentatives_eleve_passage_id_fkey" FOREIGN KEY ("passage_id") REFERENCES "passages_epreuve"("id") ON DELETE CASCADE ON UPDATE CASCADE;

