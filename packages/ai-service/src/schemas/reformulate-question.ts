import { z } from "zod";

export const reformulateQuestionInputSchema = z.object({
  notionNom: z.string(),
  enonceOriginal: z.string(),
  choixOriginal: z.array(z.string()),
  bonneReponseOriginal: z.string(),
});
export type ReformulateQuestionInput = z.infer<typeof reformulateQuestionInputSchema>;

export const reformulateQuestionOutputSchema = z.object({
  enonce: z.string(),
  choix: z.array(z.string()).min(2),
  bonneReponse: z.string(),
});
export type ReformulateQuestionOutput = z.infer<typeof reformulateQuestionOutputSchema>;
