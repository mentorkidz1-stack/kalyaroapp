import { Prisma } from "@prisma/client";
import { validerFigure, type Figure } from "@kalyaro/shared";

/**
 * Figure proposée par l'IA : gardée seulement si elle passe le schéma. Une figure invalide est
 * écartée (la question reste, sans figure) plutôt que d'être dessinée de travers.
 */
export function figureIaValide(figure: unknown): Figure | undefined {
  if (figure === null || figure === undefined) return undefined;
  const r = validerFigure(figure);
  return r.ok ? r.figure : undefined;
}

/**
 * Valeur Prisma d'un champ figure reçu dans une requête admin (déjà validé par Zod) :
 * undefined = ne pas toucher, null = effacer la figure.
 */
export function figurePourPrisma(figure: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (figure === undefined) return undefined;
  if (figure === null) return Prisma.DbNull;
  return figure as Prisma.InputJsonValue;
}
