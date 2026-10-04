import { z } from "zod";

export const explainQcmAnswerInputSchema = z.object({
  notionNom: z.string(),
  question: z.string(),
  choix: z.array(z.string()),
  reponseDonnee: z.string(),
  /**
   * Réponse donnée sur une figure (point placé, valeur lue) plutôt qu'un choix : nature de la
   * réponse et description JSON de la figure, pour que l'indice porte sur la lecture graphique.
   */
  surFigure: z
    .object({
      consigne: z.enum(["PLACER_POINT", "LIRE_VALEUR"]),
      figure: z.unknown(),
    })
    .optional(),
});
export type ExplainQcmAnswerInput = z.infer<typeof explainQcmAnswerInputSchema>;

export const explainQcmAnswerOutputSchema = z.object({
  indice: z.string(),
});
export type ExplainQcmAnswerOutput = z.infer<typeof explainQcmAnswerOutputSchema>;
