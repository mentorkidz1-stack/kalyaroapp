import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().cuid() });
export const matiereIdParamSchema = z.object({ matiereId: z.string().cuid() });
export const epreuveIdParamSchema = z.object({ epreuveId: z.string().cuid() });

const sourceCorrigeEnum = z.enum(["FOURNI", "GENERE"]);
const statutValidationEnum = z.enum(["A_VALIDER", "VALIDE"]);

export const createEpreuveSchema = z.object({
  chapitreId: z.string().cuid().optional(),
  notionPrincipaleId: z.string().cuid().optional(),
  enonce: z.string().min(1),
  sourceCorrige: sourceCorrigeEnum,
});
export const updateEpreuveSchema = z.object({
  chapitreId: z.string().cuid().nullable().optional(),
  notionPrincipaleId: z.string().cuid().nullable().optional(),
  enonce: z.string().min(1).optional(),
  sourceCorrige: sourceCorrigeEnum.optional(),
});

export const createEpreuvePdfFieldsSchema = z.object({
  chapitreId: z.string().cuid().optional(),
  notionPrincipaleId: z.string().cuid().optional(),
  sourceCorrige: sourceCorrigeEnum,
});

export const createCorrigeSchema = z.object({
  contenu: z.string().min(1),
  estPrincipal: z.boolean().default(true),
});

export const createCorrigePdfFieldsSchema = z.object({
  estPrincipal: z.coerce.boolean().default(true),
});
export const updateCorrigeSchema = z.object({
  contenu: z.string().min(1).optional(),
  estPrincipal: z.boolean().optional(),
  statutValidation: statutValidationEnum.optional(),
});
