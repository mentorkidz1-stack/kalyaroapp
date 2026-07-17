-- AlterTable
ALTER TABLE "copies_evaluation" ADD COLUMN     "reponse_photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
