import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().cuid() });

export const createClasseSchema = z.object({
  nom: z.string().min(1),
  niveau: z.string().min(1),
  anneeScolaire: z.string().optional(),
});
export const updateClasseSchema = createClasseSchema.partial();

export const createMatiereScolaireSchema = z.object({
  nom: z.string().min(1),
  classeId: z.string().cuid(),
});
export const updateMatiereScolaireSchema = z.object({
  nom: z.string().min(1).optional(),
});

export const createFiliereSchema = z.object({
  nom: z.string().min(1),
});
export const updateFiliereSchema = createFiliereSchema.partial();

const niveauUnivEnum = z.enum(["L1", "L2", "L3", "M1", "M2"]);

export const createNiveauUniversitaireSchema = z.object({
  filiereId: z.string().cuid(),
  nom: niveauUnivEnum,
});
export const updateNiveauUniversitaireSchema = z.object({
  nom: niveauUnivEnum.optional(),
});

export const createUEMatiereSchema = z.object({
  nom: z.string().min(1),
  niveauUniversitaireId: z.string().cuid(),
});
export const updateUEMatiereSchema = z.object({
  nom: z.string().min(1).optional(),
});
