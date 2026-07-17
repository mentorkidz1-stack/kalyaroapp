import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().cuid() });
export const matiereIdParamSchema = z.object({ matiereId: z.string().cuid() });
export const photoParamSchema = z.object({ id: z.string().cuid(), index: z.coerce.number().int().min(0) });

export const MAX_PHOTOS = 5;
export const ALLOWED_IMAGE_MIMETYPES = ["image/jpeg", "image/png", "image/webp"];

export const createEvaluationFieldsSchema = z.object({
  titre: z.string().min(1),
  chapitreId: z.string().cuid().optional(),
  enonce: z.string().min(1).optional(),
  dureeMinutes: z.coerce.number().int().positive(),
  bareme: z.coerce.number().int().positive(),
});

export const updateEvaluationSchema = z.object({
  titre: z.string().min(1).optional(),
  chapitreId: z.string().cuid().nullable().optional(),
  dureeMinutes: z.number().int().positive().optional(),
  bareme: z.number().int().positive().optional(),
});

export const corrigerCopieSchema = z.object({
  noteObtenue: z.number().min(0),
  commentaireAdmin: z.string().optional(),
  pointsForts: z.array(z.string()).optional(),
  pointsATravailler: z.array(z.string()).optional(),
});

export const genererFeedbackIaSchema = z.object({
  noteObtenue: z.number().min(0),
  indicationAdmin: z.string().optional(),
});

// reponseDonnee peut être vide : la soumission automatique à expiration du délai doit
// toujours réussir, même si l'élève n'a rien écrit.
export const soumettreCopieSchema = z.object({
  reponseDonnee: z.string(),
});
