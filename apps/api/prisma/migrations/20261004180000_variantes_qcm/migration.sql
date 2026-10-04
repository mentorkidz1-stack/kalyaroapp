-- Variantes de questions pré-validées (chantier 1.3) : auto-relation vers la question d'origine.
-- Colonne nullable, aucune donnée existante modifiée. Si l'origine est supprimée, la variante reste.
-- AlterTable
ALTER TABLE "questions_qcm" ADD COLUMN     "variante_de_id" TEXT;

-- CreateIndex
CREATE INDEX "questions_qcm_variante_de_id_idx" ON "questions_qcm"("variante_de_id");

-- AddForeignKey
ALTER TABLE "questions_qcm" ADD CONSTRAINT "questions_qcm_variante_de_id_fkey" FOREIGN KEY ("variante_de_id") REFERENCES "questions_qcm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

