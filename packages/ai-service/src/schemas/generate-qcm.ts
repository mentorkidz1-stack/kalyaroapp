import { z } from "zod";

export const generateQcmInputSchema = z.object({
  chapitreTitre: z.string(),
  texteCours: z.string(),
  notionsExistantes: z.array(z.string()),
  nombreQuestions: z.number().int().min(1).max(20),
});
export type GenerateQcmInput = z.infer<typeof generateQcmInputSchema>;

export const generateQcmOutputSchema = z.object({
  questions: z.array(
    z.object({
      enonce: z.string(),
      choix: z.array(z.string()).min(2),
      bonneReponse: z.string(),
      notionTag: z.string(),
      difficulte: z.enum(["FACILE", "MOYEN", "DIFFICILE"]),
    })
  ),
});
export type GenerateQcmOutput = z.infer<typeof generateQcmOutputSchema>;
