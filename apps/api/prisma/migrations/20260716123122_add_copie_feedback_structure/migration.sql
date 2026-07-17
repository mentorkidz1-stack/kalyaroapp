-- AlterTable
ALTER TABLE "copies_evaluation" ADD COLUMN     "points_a_travailler" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "points_forts" TEXT[] DEFAULT ARRAY[]::TEXT[];
