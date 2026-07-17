import { z } from "zod";

export const generateMetacognitiveQuestionInputSchema = z.object({
  question: z.string(),
  bonneReponse: z.string(),
  notionNom: z.string(),
});
export type GenerateMetacognitiveQuestionInput = z.infer<
  typeof generateMetacognitiveQuestionInputSchema
>;

export const generateMetacognitiveQuestionOutputSchema = z.object({
  enonce: z.string(),
});
export type GenerateMetacognitiveQuestionOutput = z.infer<
  typeof generateMetacognitiveQuestionOutputSchema
>;
