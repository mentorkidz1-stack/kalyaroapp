import { z } from "zod";

export const evaluateFreeAnswerInputSchema = z.object({
  question: z.string(),
  reponseReference: z.string(),
  reponseEleve: z.string(),
});
export type EvaluateFreeAnswerInput = z.infer<typeof evaluateFreeAnswerInputSchema>;

export const evaluateFreeAnswerOutputSchema = z.object({
  valide: z.boolean(),
  explication: z.string(),
});
export type EvaluateFreeAnswerOutput = z.infer<typeof evaluateFreeAnswerOutputSchema>;
