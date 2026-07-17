-- Empêche une notion d'être son propre prérequis (non exprimable dans le schema Prisma).
ALTER TABLE "prerequis" ADD CONSTRAINT "prerequis_no_self_reference" CHECK ("notion_id" <> "prerequis_notion_id");
