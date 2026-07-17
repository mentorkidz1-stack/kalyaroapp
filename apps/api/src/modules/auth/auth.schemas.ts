import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
    nom: z.string().min(1),
    typeParcours: z.enum(["SCOLAIRE", "UNIVERSITAIRE"]),
    classeId: z.string().cuid().optional(),
    niveauUniversitaireId: z.string().cuid().optional(),
  })
  .refine(
    (data) =>
      data.typeParcours === "SCOLAIRE"
        ? Boolean(data.classeId) && !data.niveauUniversitaireId
        : Boolean(data.niveauUniversitaireId) && !data.classeId,
    {
      message:
        "classeId requis pour un parcours scolaire, niveauUniversitaireId pour un parcours universitaire (jamais les deux)",
    }
  );

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  nom: z.string().min(1),
});
