import { z } from "zod";

export const generateAnswerKeyInputSchema = z.object({
  enonceEpreuve: z.string(),
  contexteCours: z.string().optional(),
});
export type GenerateAnswerKeyInput = z.infer<typeof generateAnswerKeyInputSchema>;

export const generateAnswerKeyOutputSchema = z.object({
  corrige: z.string(),
  demarche: z.string(),
});
export type GenerateAnswerKeyOutput = z.infer<typeof generateAnswerKeyOutputSchema>;
