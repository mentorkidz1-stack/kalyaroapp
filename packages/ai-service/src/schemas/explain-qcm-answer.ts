import { z } from "zod";

export const explainQcmAnswerInputSchema = z.object({
  notionNom: z.string(),
  question: z.string(),
  choix: z.array(z.string()),
  reponseDonnee: z.string(),
});
export type ExplainQcmAnswerInput = z.infer<typeof explainQcmAnswerInputSchema>;

export const explainQcmAnswerOutputSchema = z.object({
  indice: z.string(),
});
export type ExplainQcmAnswerOutput = z.infer<typeof explainQcmAnswerOutputSchema>;
