-- Examen blanc (chantier 2.2) : heure limite, brouillons, temps par question, verrou de
-- correction sur les passages. Colonnes nullables : aucune donnée existante modifiée.
-- AlterTable
ALTER TABLE "passages_epreuve" ADD COLUMN     "brouillons" JSONB,
ADD COLUMN     "correction_demarree_at" TIMESTAMP(3),
ADD COLUMN     "date_limite_at" TIMESTAMP(3),
ADD COLUMN     "temps_par_question" JSONB;

