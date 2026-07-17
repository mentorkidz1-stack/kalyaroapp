import { z } from "zod";

export const generateInitialDiagnosticInputSchema = z.object({
  chapitreTitre: z.string(),
  notionsChapitre: z.array(z.object({ nom: z.string(), description: z.string() })).min(1),
  notionsPrerequisesExternes: z.array(z.object({ nom: z.string(), description: z.string() })),
});
export type GenerateInitialDiagnosticInput = z.infer<typeof generateInitialDiagnosticInputSchema>;

export const generateInitialDiagnosticOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        enonce: z.string(),
        choix: z.array(z.string()).min(2),
        bonneReponse: z.string(),
        notionNom: z.string(),
      })
    )
    .min(3)
    .max(4),
});
export type GenerateInitialDiagnosticOutput = z.infer<typeof generateInitialDiagnosticOutputSchema>;
