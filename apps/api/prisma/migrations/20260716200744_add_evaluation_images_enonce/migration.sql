-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "images_enonce" TEXT[] DEFAULT ARRAY[]::TEXT[];
