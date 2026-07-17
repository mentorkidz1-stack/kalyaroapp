-- CreateEnum
CREATE TYPE "TypeParcours" AS ENUM ('SCOLAIRE', 'UNIVERSITAIRE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ELEVE', 'ETUDIANT');

-- CreateEnum
CREATE TYPE "NiveauUniv" AS ENUM ('L1', 'L2', 'L3', 'M1', 'M2');

-- CreateEnum
CREATE TYPE "StatutExtraction" AS ENUM ('PENDING', 'DONE', 'ERROR');

-- CreateEnum
CREATE TYPE "StatutPrerequis" AS ENUM ('PROPOSE_IA', 'VALIDE_ADMIN');

-- CreateEnum
CREATE TYPE "SourceQuestion" AS ENUM ('IA', 'MANUEL');

-- CreateEnum
CREATE TYPE "StatutQuestion" AS ENUM ('BROUILLON', 'A_VALIDER', 'PUBLIE');

-- CreateEnum
CREATE TYPE "Difficulte" AS ENUM ('FACILE', 'MOYEN', 'DIFFICILE');

-- CreateEnum
CREATE TYPE "SourceCorrige" AS ENUM ('FOURNI', 'GENERE');

-- CreateEnum
CREATE TYPE "StatutValidation" AS ENUM ('A_VALIDER', 'VALIDE');

-- CreateEnum
CREATE TYPE "TypeCibleTentative" AS ENUM ('QCM', 'SAISIE_LIBRE', 'EPREUVE');

-- CreateEnum
CREATE TYPE "StatutMaitriseNotion" AS ENUM ('NON_VU', 'FRAGILE', 'MAITRISE');

-- CreateEnum
CREATE TYPE "StatutChapitre" AS ENUM ('NON_COMMENCE', 'EN_COURS', 'MAITRISE');

-- CreateEnum
CREATE TYPE "StatutFicheResume" AS ENUM ('A_VALIDER', 'PUBLIE');

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "annee_scolaire" TEXT,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matieres_scolaires" (
    "id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "matieres_scolaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filieres" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "filieres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niveaux_universitaires" (
    "id" TEXT NOT NULL,
    "filiere_id" TEXT NOT NULL,
    "nom" "NiveauUniv" NOT NULL,

    CONSTRAINT "niveaux_universitaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ue_matieres" (
    "id" TEXT NOT NULL,
    "niveau_universitaire_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "ue_matieres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matieres" (
    "id" TEXT NOT NULL,
    "type" "TypeParcours" NOT NULL,

    CONSTRAINT "matieres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "nom" TEXT NOT NULL,
    "classe_id" TEXT,
    "niveau_universitaire_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cours" (
    "id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "fichier_pdf_url" TEXT NOT NULL,
    "contenu_extrait" TEXT,
    "statut_extraction" "StatutExtraction" NOT NULL DEFAULT 'PENDING',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapitres" (
    "id" TEXT NOT NULL,
    "cours_id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "chapitres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notions" (
    "id" TEXT NOT NULL,
    "chapitre_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "notions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prerequis" (
    "notion_id" TEXT NOT NULL,
    "prerequis_notion_id" TEXT NOT NULL,
    "statut" "StatutPrerequis" NOT NULL DEFAULT 'PROPOSE_IA',

    CONSTRAINT "prerequis_pkey" PRIMARY KEY ("notion_id","prerequis_notion_id")
);

-- CreateTable
CREATE TABLE "questions_qcm" (
    "id" TEXT NOT NULL,
    "chapitre_id" TEXT NOT NULL,
    "enonce" TEXT NOT NULL,
    "choix" JSONB NOT NULL,
    "bonne_reponse" TEXT NOT NULL,
    "source" "SourceQuestion" NOT NULL,
    "statut" "StatutQuestion" NOT NULL DEFAULT 'BROUILLON',
    "difficulte" "Difficulte" NOT NULL DEFAULT 'MOYEN',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_qcm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions_qcm_notions" (
    "question_qcm_id" TEXT NOT NULL,
    "notion_id" TEXT NOT NULL,

    CONSTRAINT "questions_qcm_notions_pkey" PRIMARY KEY ("question_qcm_id","notion_id")
);

-- CreateTable
CREATE TABLE "questions_saisie_libre" (
    "id" TEXT NOT NULL,
    "chapitre_id" TEXT NOT NULL,
    "enonce" TEXT NOT NULL,
    "reponse_reference" TEXT NOT NULL,
    "source" "SourceQuestion" NOT NULL,
    "statut" "StatutQuestion" NOT NULL DEFAULT 'BROUILLON',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_saisie_libre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions_saisie_libre_notions" (
    "question_saisie_libre_id" TEXT NOT NULL,
    "notion_id" TEXT NOT NULL,

    CONSTRAINT "questions_saisie_libre_notions_pkey" PRIMARY KEY ("question_saisie_libre_id","notion_id")
);

-- CreateTable
CREATE TABLE "questions_metacognitives" (
    "id" TEXT NOT NULL,
    "question_qcm_id" TEXT,
    "question_saisie_libre_id" TEXT,
    "enonce" TEXT NOT NULL,
    "source" "SourceQuestion" NOT NULL,

    CONSTRAINT "questions_metacognitives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epreuves" (
    "id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "chapitre_id" TEXT,
    "enonce" TEXT NOT NULL,
    "source_corrige" "SourceCorrige" NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epreuves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corriges_types" (
    "id" TEXT NOT NULL,
    "epreuve_id" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "est_principal" BOOLEAN NOT NULL DEFAULT true,
    "statut_validation" "StatutValidation" NOT NULL DEFAULT 'A_VALIDER',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corriges_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tentatives_eleve" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "type_cible" "TypeCibleTentative" NOT NULL,
    "question_qcm_id" TEXT,
    "question_saisie_libre_id" TEXT,
    "epreuve_id" TEXT,
    "reponse_donnee" TEXT NOT NULL,
    "correcte" BOOLEAN,
    "evaluation_ia" JSONB,
    "tentative_numero" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tentatives_eleve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progressions_notion" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "notion_id" TEXT NOT NULL,
    "statut" "StatutMaitriseNotion" NOT NULL DEFAULT 'NON_VU',
    "nb_echecs_consecutifs" INTEGER NOT NULL DEFAULT 0,
    "derniere_revision_at" TIMESTAMP(3),
    "prochaine_revision_at" TIMESTAMP(3),

    CONSTRAINT "progressions_notion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progressions_chapitre" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "chapitre_id" TEXT NOT NULL,
    "statut" "StatutChapitre" NOT NULL DEFAULT 'NON_COMMENCE',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progressions_chapitre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiches_resume" (
    "id" TEXT NOT NULL,
    "notion_id" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "statut" "StatutFicheResume" NOT NULL DEFAULT 'A_VALIDER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiches_resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostics_initiaux" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "chapitre_id" TEXT NOT NULL,
    "resultat" JSONB NOT NULL,
    "niveau_recommande" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostics_initiaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostics_prerequis" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "epreuve_id" TEXT NOT NULL,
    "notion_declenchante_id" TEXT NOT NULL,
    "notion_prerequis_testee_id" TEXT NOT NULL,
    "resolu" BOOLEAN NOT NULL DEFAULT false,
    "chemin_parcouru" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostics_prerequis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reponses_metacognitives" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "question_metacognitive_id" TEXT NOT NULL,
    "tentative_id" TEXT NOT NULL,
    "reponse_texte" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reponses_metacognitives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "progressions_notion_eleve_id_notion_id_key" ON "progressions_notion"("eleve_id", "notion_id");

-- CreateIndex
CREATE UNIQUE INDEX "progressions_chapitre_eleve_id_chapitre_id_key" ON "progressions_chapitre"("eleve_id", "chapitre_id");

-- AddForeignKey
ALTER TABLE "matieres_scolaires" ADD CONSTRAINT "matieres_scolaires_id_fkey" FOREIGN KEY ("id") REFERENCES "matieres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matieres_scolaires" ADD CONSTRAINT "matieres_scolaires_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "niveaux_universitaires" ADD CONSTRAINT "niveaux_universitaires_filiere_id_fkey" FOREIGN KEY ("filiere_id") REFERENCES "filieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ue_matieres" ADD CONSTRAINT "ue_matieres_id_fkey" FOREIGN KEY ("id") REFERENCES "matieres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ue_matieres" ADD CONSTRAINT "ue_matieres_niveau_universitaire_id_fkey" FOREIGN KEY ("niveau_universitaire_id") REFERENCES "niveaux_universitaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_niveau_universitaire_id_fkey" FOREIGN KEY ("niveau_universitaire_id") REFERENCES "niveaux_universitaires"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cours" ADD CONSTRAINT "cours_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cours" ADD CONSTRAINT "cours_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapitres" ADD CONSTRAINT "chapitres_cours_id_fkey" FOREIGN KEY ("cours_id") REFERENCES "cours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notions" ADD CONSTRAINT "notions_chapitre_id_fkey" FOREIGN KEY ("chapitre_id") REFERENCES "chapitres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequis" ADD CONSTRAINT "prerequis_notion_id_fkey" FOREIGN KEY ("notion_id") REFERENCES "notions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prerequis" ADD CONSTRAINT "prerequis_prerequis_notion_id_fkey" FOREIGN KEY ("prerequis_notion_id") REFERENCES "notions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_qcm" ADD CONSTRAINT "questions_qcm_chapitre_id_fkey" FOREIGN KEY ("chapitre_id") REFERENCES "chapitres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_qcm" ADD CONSTRAINT "questions_qcm_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_qcm_notions" ADD CONSTRAINT "questions_qcm_notions_question_qcm_id_fkey" FOREIGN KEY ("question_qcm_id") REFERENCES "questions_qcm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_qcm_notions" ADD CONSTRAINT "questions_qcm_notions_notion_id_fkey" FOREIGN KEY ("notion_id") REFERENCES "notions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_saisie_libre" ADD CONSTRAINT "questions_saisie_libre_chapitre_id_fkey" FOREIGN KEY ("chapitre_id") REFERENCES "chapitres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_saisie_libre" ADD CONSTRAINT "questions_saisie_libre_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_saisie_libre_notions" ADD CONSTRAINT "questions_saisie_libre_notions_question_saisie_libre_id_fkey" FOREIGN KEY ("question_saisie_libre_id") REFERENCES "questions_saisie_libre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_saisie_libre_notions" ADD CONSTRAINT "questions_saisie_libre_notions_notion_id_fkey" FOREIGN KEY ("notion_id") REFERENCES "notions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_metacognitives" ADD CONSTRAINT "questions_metacognitives_question_qcm_id_fkey" FOREIGN KEY ("question_qcm_id") REFERENCES "questions_qcm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions_metacognitives" ADD CONSTRAINT "questions_metacognitives_question_saisie_libre_id_fkey" FOREIGN KEY ("question_saisie_libre_id") REFERENCES "questions_saisie_libre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epreuves" ADD CONSTRAINT "epreuves_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "matieres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epreuves" ADD CONSTRAINT "epreuves_chapitre_id_fkey" FOREIGN KEY ("chapitre_id") REFERENCES "chapitres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epreuves" ADD CONSTRAINT "epreuves_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corriges_types" ADD CONSTRAINT "corriges_types_epreuve_id_fkey" FOREIGN KEY ("epreuve_id") REFERENCES "epreuves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corriges_types" ADD CONSTRAINT "corriges_types_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentatives_eleve" ADD CONSTRAINT "tentatives_eleve_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentatives_eleve" ADD CONSTRAINT "tentatives_eleve_question_qcm_id_fkey" FOREIGN KEY ("question_qcm_id") REFERENCES "questions_qcm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentatives_eleve" ADD CONSTRAINT "tentatives_eleve_question_saisie_libre_id_fkey" FOREIGN KEY ("question_saisie_libre_id") REFERENCES "questions_saisie_libre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentatives_eleve" ADD CONSTRAINT "tentatives_eleve_epreuve_id_fkey" FOREIGN KEY ("epreuve_id") REFERENCES "epreuves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progressions_notion" ADD CONSTRAINT "progressions_notion_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progressions_notion" ADD CONSTRAINT "progressions_notion_notion_id_fkey" FOREIGN KEY ("notion_id") REFERENCES "notions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progressions_chapitre" ADD CONSTRAINT "progressions_chapitre_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progressions_chapitre" ADD CONSTRAINT "progressions_chapitre_chapitre_id_fkey" FOREIGN KEY ("chapitre_id") REFERENCES "chapitres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiches_resume" ADD CONSTRAINT "fiches_resume_notion_id_fkey" FOREIGN KEY ("notion_id") REFERENCES "notions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostics_initiaux" ADD CONSTRAINT "diagnostics_initiaux_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostics_initiaux" ADD CONSTRAINT "diagnostics_initiaux_chapitre_id_fkey" FOREIGN KEY ("chapitre_id") REFERENCES "chapitres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostics_prerequis" ADD CONSTRAINT "diagnostics_prerequis_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostics_prerequis" ADD CONSTRAINT "diagnostics_prerequis_epreuve_id_fkey" FOREIGN KEY ("epreuve_id") REFERENCES "epreuves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostics_prerequis" ADD CONSTRAINT "diagnostics_prerequis_notion_declenchante_id_fkey" FOREIGN KEY ("notion_declenchante_id") REFERENCES "notions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostics_prerequis" ADD CONSTRAINT "diagnostics_prerequis_notion_prerequis_testee_id_fkey" FOREIGN KEY ("notion_prerequis_testee_id") REFERENCES "notions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_metacognitives" ADD CONSTRAINT "reponses_metacognitives_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_metacognitives" ADD CONSTRAINT "reponses_metacognitives_question_metacognitive_id_fkey" FOREIGN KEY ("question_metacognitive_id") REFERENCES "questions_metacognitives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponses_metacognitives" ADD CONSTRAINT "reponses_metacognitives_tentative_id_fkey" FOREIGN KEY ("tentative_id") REFERENCES "tentatives_eleve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
