import { z } from "zod";

export const epreuveIdParamSchema = z.object({ epreuveId: z.string().cuid() });
export const passageIdParamSchema = z.object({ passageId: z.string().cuid() });
export const questionParamSchema = z.object({
  passageId: z.string().cuid(),
  // Id d'une QuestionEpreuve, ou « unique » pour une épreuve non découpée.
  cle: z.union([z.string().cuid(), z.literal("unique")]),
});
export const repondreQuestionSchema = z.object({
  reponseDonnee: z.string().trim().min(1).max(10_000),
});
