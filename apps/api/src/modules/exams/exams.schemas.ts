import { z } from "zod";
import { figureOptionnelleSchema } from "@kalyaro/shared";

export const idParamSchema = z.object({ id: z.string().cuid() });
export const matiereIdParamSchema = z.object({ matiereId: z.string().cuid() });
export const epreuveIdParamSchema = z.object({ epreuveId: z.string().cuid() });

const sourceCorrigeEnum = z.enum(["FOURNI", "GENERE"]);
const statutValidationEnum = z.enum(["A_VALIDER", "VALIDE"]);

// Métadonnées d'origine du sujet (chantier 2.1), toutes facultatives.
const texteCourt = (max: number) => z.string().trim().min(1).max(max);
const metadonneesEpreuve = {
  annee: z.number().int().min(1990).max(2100).nullable().optional(),
  session: texteCourt(100).nullable().optional(),
  examen: texteCourt(150).nullable().optional(),
  etablissementSource: texteCourt(200).nullable().optional(),
  dureeMinutes: z.number().int().min(5).max(600).nullable().optional(),
  bareme: z.number().positive().max(1000).nullable().optional(),
};

export const createEpreuveSchema = z.object({
  chapitreId: z.string().cuid().optional(),
  notionPrincipaleId: z.string().cuid().optional(),
  enonce: z.string().min(1),
  sourceCorrige: sourceCorrigeEnum,
  ...metadonneesEpreuve,
});
export const updateEpreuveSchema = z.object({
  chapitreId: z.string().cuid().nullable().optional(),
  notionPrincipaleId: z.string().cuid().nullable().optional(),
  enonce: z.string().min(1).optional(),
  sourceCorrige: sourceCorrigeEnum.optional(),
  ...metadonneesEpreuve,
});

// Champs multipart : tout arrive en texte, d'où les coercitions.
const nombreFormulaire = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === undefined || v === "" ? undefined : Number(v)), schema.optional());
export const createEpreuvePdfFieldsSchema = z.object({
  chapitreId: z.string().cuid().optional(),
  notionPrincipaleId: z.string().cuid().optional(),
  sourceCorrige: sourceCorrigeEnum,
  annee: nombreFormulaire(z.number().int().min(1990).max(2100)),
  session: texteCourt(100).optional(),
  examen: texteCourt(150).optional(),
  etablissementSource: texteCourt(200).optional(),
  dureeMinutes: nombreFormulaire(z.number().int().min(5).max(600)),
  bareme: nombreFormulaire(z.number().positive().max(1000)),
});

// ---- Découpage en questions ----
export const questionEpreuveIdParamSchema = z.object({ questionId: z.string().cuid() });
/** Clé d'image stockée : uuid + nom assaini (jamais de chemin). */
export const imageQuestionParamSchema = z.object({
  questionId: z.string().cuid(),
  cle: z.string().regex(/^[a-zA-Z0-9._-]{1,200}$/),
});

export const remplacerQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().cuid().optional(),
        numero: texteCourt(20),
        enonce: z.string().trim().min(1),
        points: z.number().positive().max(1000),
        notionId: z.string().cuid().nullable().optional(),
        figure: figureOptionnelleSchema,
      })
    )
    .max(100),
});

export const proposerDecoupageSchema = z.object({
  bareme: z.number().positive().max(1000).optional(),
});

export const createCorrigeQuestionSchema = z.object({
  contenu: z.string().trim().min(1),
  estPrincipal: z.boolean().default(true),
});
export const updateCorrigeQuestionSchema = z.object({
  contenu: z.string().trim().min(1).optional(),
  estPrincipal: z.boolean().optional(),
  statutValidation: statutValidationEnum.optional(),
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
