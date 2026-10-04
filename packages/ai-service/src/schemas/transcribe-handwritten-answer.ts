import { z } from "zod";

export const transcribeHandwrittenAnswerInputSchema = z.object({
  parcours: z.enum(["SCOLAIRE", "UNIVERSITAIRE"]),
  /** Questions susceptibles de figurer sur les photos (numéro tel qu'affiché + énoncé). */
  questions: z.array(z.object({ numero: z.string(), enonce: z.string() })).min(1),
});
export type TranscribeHandwrittenAnswerInput = z.infer<typeof transcribeHandwrittenAnswerInputSchema>;

export const transcribeHandwrittenAnswerOutputSchema = z.object({
  /** false si les photos sont trop floues, sombres ou coupées pour être lues sérieusement. */
  lisible: z.boolean(),
  /** Une entrée par question effectivement traitée sur la copie ; une question absente est omise. */
  questions: z.array(z.object({ numero: z.string(), transcription: z.string() })),
  /** Conseil court à l'étudiant (photo floue, page coupée…) ou null. */
  remarque: z.string().nullable(),
});
export type TranscribeHandwrittenAnswerOutput = z.infer<typeof transcribeHandwrittenAnswerOutputSchema>;
