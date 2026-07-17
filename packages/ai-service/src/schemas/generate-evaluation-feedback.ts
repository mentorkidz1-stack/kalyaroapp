import { z } from "zod";

export const generateEvaluationFeedbackInputSchema = z.object({
  enonce: z.string(),
  reponseEleve: z.string(),
  noteObtenue: z.number(),
  bareme: z.number(),
  indicationAdmin: z.string().optional(),
});
export type GenerateEvaluationFeedbackInput = z.infer<typeof generateEvaluationFeedbackInputSchema>;

export const generateEvaluationFeedbackOutputSchema = z.object({
  pointsForts: z.array(z.string()).min(1).max(6),
  pointsATravailler: z.array(z.string()).min(1).max(6),
});
export type GenerateEvaluationFeedbackOutput = z.infer<typeof generateEvaluationFeedbackOutputSchema>;
