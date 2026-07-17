import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().cuid() });
export const chapitreIdParamSchema = z.object({ chapitreId: z.string().cuid() });

const difficulteEnum = z.enum(["FACILE", "MOYEN", "DIFFICILE"]);
const statutEnum = z.enum(["BROUILLON", "A_VALIDER", "PUBLIE"]);

export const createQcmSchema = z
  .object({
    enonce: z.string().min(1),
    choix: z.array(z.string().min(1)).min(2),
    bonneReponse: z.string().min(1),
    difficulte: difficulteEnum.default("MOYEN"),
    notionIds: z.array(z.string().cuid()).min(1),
  })
  .refine((data) => data.choix.includes(data.bonneReponse), {
    message: "bonneReponse doit être l'un des choix",
    path: ["bonneReponse"],
  });

export const updateQcmSchema = z.object({
  enonce: z.string().min(1).optional(),
  choix: z.array(z.string().min(1)).min(2).optional(),
  bonneReponse: z.string().min(1).optional(),
  difficulte: difficulteEnum.optional(),
  statut: statutEnum.optional(),
  notionIds: z.array(z.string().cuid()).optional(),
});

export const generateQcmIaSchema = z.object({
  nombreQuestions: z.number().int().min(1).max(20).default(5),
});

export const createSaisieLibreSchema = z.object({
  enonce: z.string().min(1),
  reponseReference: z.string().min(1),
  notionIds: z.array(z.string().cuid()).min(1),
});

export const updateSaisieLibreSchema = z.object({
  enonce: z.string().min(1).optional(),
  reponseReference: z.string().min(1).optional(),
  statut: statutEnum.optional(),
  notionIds: z.array(z.string().cuid()).optional(),
});

export const generateSaisieLibreIaSchema = z.object({
  nombreQuestions: z.number().int().min(1).max(20).default(5),
});
