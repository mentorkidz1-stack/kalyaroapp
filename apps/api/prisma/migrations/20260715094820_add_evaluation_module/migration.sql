-- CreateEnum
CREATE TYPE "StatutCopie" AS ENUM ('EN_COURS', 'SOUMIS', 'CORRIGE');

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "chapitre_id" TEXT,
    "titre" TEXT NOT NULL,
    "enonce" TEXT,
    "fichier_pdf_url" TEXT,
    "contenu_extrait" TEXT,
    "statut_extraction" "StatutExtraction",
    "duree_minutes" INTEGER NOT NULL,
    "bareme" INTEGER NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copies_evaluation" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "statut" "StatutCopie" NOT NULL DEFAULT 'EN_COURS',
    "demarre_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_limite_at" TIMESTAMP(3) NOT NULL,
    "reponse_donnee" TEXT,
    "soumis_at" TIMESTAMP(3),
    "hors_delai" BOOLEAN NOT NULL DEFAULT false,
    "note_obtenue" DOUBLE PRECISION,
    "commentaire_admin" TEXT,
    "corrige_par" TEXT,
    "corrige_at" TIMESTAMP(3),

    CONSTRAINT "copies_evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "copies_evaluation_evaluation_id_eleve_id_key" ON "copies_evaluation"("evaluation_id", "eleve_id");

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_chapitre_id_fkey" FOREIGN KEY ("chapitre_id") REFERENCES "chapitres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copies_evaluation" ADD CONSTRAINT "copies_evaluation_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copies_evaluation" ADD CONSTRAINT "copies_evaluation_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copies_evaluation" ADD CONSTRAINT "copies_evaluation_corrige_par_fkey" FOREIGN KEY ("corrige_par") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
