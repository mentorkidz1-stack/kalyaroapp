import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().cuid() });

export const listUsersQuerySchema = z.object({
  role: z.enum(["ADMIN", "ELEVE", "ETUDIANT"]).optional(),
  classeId: z.string().cuid().optional(),
  niveauUniversitaireId: z.string().cuid().optional(),
  q: z.string().min(1).optional(),
});

export const updateUserSchema = z.object({
  nom: z.string().min(1).optional(),
  classeId: z.string().cuid().nullable().optional(),
  niveauUniversitaireId: z.string().cuid().nullable().optional(),
  actif: z.boolean().optional(),
});
