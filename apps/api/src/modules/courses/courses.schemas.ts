import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().cuid() });
export const coursChapitreParamSchema = z.object({ coursId: z.string().cuid() });

export const createCoursFieldsSchema = z.object({
  titre: z.string().min(1),
  matiereId: z.string().cuid(),
});

export const updateCoursSchema = z.object({
  titre: z.string().min(1).optional(),
  matiereId: z.string().cuid().optional(),
});

export const createChapitreSchema = z.object({
  titre: z.string().min(1),
  ordre: z.number().int().min(0).optional(),
});

export const updateChapitreSchema = createChapitreSchema.partial();
