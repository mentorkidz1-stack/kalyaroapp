import { z } from "zod";

export const generateSaisieLibreInputSchema = z.object({
  chapitreTitre: z.string(),
  texteCours: z.string(),
  notionsExistantes: z.array(z.string()),
  nombreQuestions: z.number().int().min(1).max(20),
});
export type GenerateSaisieLibreInput = z.infer<typeof generateSaisieLibreInputSchema>;

export const generateSaisieLibreOutputSchema = z.object({
  questions: z.array(
    z.object({
      enonce: z.string(),
      reponseReference: z.string(),
      notionTag: z.string(),
  /** Description de figure (validée ensuite par le serveur ; écartée si invalide). */
  figure: z.unknown().nullable().optional(),
    })
  ),
});
export type GenerateSaisieLibreOutput = z.infer<typeof generateSaisieLibreOutputSchema>;
