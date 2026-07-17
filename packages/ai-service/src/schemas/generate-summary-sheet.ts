import { z } from "zod";

export const generateSummarySheetInputSchema = z.object({
  notionNom: z.string(),
  notionDescription: z.string(),
  contexteCours: z.string().optional(),
});
export type GenerateSummarySheetInput = z.infer<typeof generateSummarySheetInputSchema>;

export const generateSummarySheetOutputSchema = z.object({
  titre: z.string(),
  contenuMarkdown: z.string(),
});
export type GenerateSummarySheetOutput = z.infer<typeof generateSummarySheetOutputSchema>;
