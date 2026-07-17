-- AlterTable
ALTER TABLE "epreuves" ADD COLUMN     "notion_principale_id" TEXT;

-- AddForeignKey
ALTER TABLE "epreuves" ADD CONSTRAINT "epreuves_notion_principale_id_fkey" FOREIGN KEY ("notion_principale_id") REFERENCES "notions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
