-- CreateEnum
CREATE TYPE "Confiance" AS ENUM ('SUR', 'HESITE', 'HASARD');

-- AlterTable
ALTER TABLE "progressions_notion" ADD COLUMN     "erreur_assuree_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tentatives_eleve" ADD COLUMN     "confiance" "Confiance";

