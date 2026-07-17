-- AlterTable
ALTER TABLE "progressions_notion" ADD COLUMN     "intervalle_revision_jours" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "nb_succes_consecutifs" INTEGER NOT NULL DEFAULT 0;
