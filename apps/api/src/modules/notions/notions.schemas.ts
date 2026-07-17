import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().cuid() });
export const chapitreIdParamSchema = z.object({ chapitreId: z.string().cuid() });
export const notionIdParamSchema = z.object({ notionId: z.string().cuid() });
export const prerequisParamSchema = z.object({
  notionId: z.string().cuid(),
  prerequisNotionId: z.string().cuid(),
});

export const updateFicheResumeSchema = z.object({
  contenu: z.string().min(1).optional(),
  statut: z.enum(["A_VALIDER", "PUBLIE"]).optional(),
});

export const createNotionSchema = z.object({
  nom: z.string().min(1),
  description: z.string().optional(),
});
export const updateNotionSchema = createNotionSchema.partial();

export const createPrerequisSchema = z.object({
  notionId: z.string().cuid(),
  prerequisNotionId: z.string().cuid(),
});
