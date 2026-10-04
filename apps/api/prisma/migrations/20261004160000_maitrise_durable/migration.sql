-- Maîtrise durable (chantier 1.2) : MAITRISE devient CONSOLIDE, ajout de ACQUIS_DU_JOUR et DURABLE.
-- Renommage plutôt que suppression/recréation de l'enum : les lignes existantes en MAITRISE
-- deviennent CONSOLIDE sans réécriture ni perte de données.
ALTER TYPE "StatutMaitriseNotion" RENAME VALUE 'MAITRISE' TO 'CONSOLIDE';
ALTER TYPE "StatutMaitriseNotion" ADD VALUE 'ACQUIS_DU_JOUR' BEFORE 'CONSOLIDE';
ALTER TYPE "StatutMaitriseNotion" ADD VALUE 'DURABLE' AFTER 'CONSOLIDE';

-- Dernière réponse sur la notion (série de réussites « dans la journée »). Nullable : une
-- progression existante sans valeur repart simplement d'une série vierge.
ALTER TABLE "progressions_notion" ADD COLUMN "derniere_tentative_at" TIMESTAMP(3);
