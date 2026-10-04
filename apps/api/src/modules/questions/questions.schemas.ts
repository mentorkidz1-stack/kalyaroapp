import { z } from "zod";
import { figureOptionnelleSchema, libelleReponseAttendue, reponseAttendueSchema, verifierQuestionSurFigure } from "@kalyaro/shared";

export const idParamSchema = z.object({ id: z.string().cuid() });
export const chapitreIdParamSchema = z.object({ chapitreId: z.string().cuid() });

const difficulteEnum = z.enum(["FACILE", "MOYEN", "DIFFICILE"]);
const statutEnum = z.enum(["BROUILLON", "A_VALIDER", "PUBLIE"]);

const typeReponseEnum = z.enum(["CHOIX", "PLACER_POINT", "LIRE_VALEUR"]);

/**
 * QCM à choix, ou à réponse sur la figure (placer un point, lire une valeur) : dans ce cas,
 * pas de choix, une réponse attendue avec tolérance, et une figure adaptée obligatoire.
 */
export const createQcmSchema = z
  .object({
    enonce: z.string().min(1),
    typeReponse: typeReponseEnum.default("CHOIX"),
    choix: z.array(z.string().min(1)).default([]),
    bonneReponse: z.string().default(""),
    reponseAttendue: reponseAttendueSchema.optional(),
    difficulte: difficulteEnum.default("MOYEN"),
    notionIds: z.array(z.string().cuid()).min(1),
    figure: figureOptionnelleSchema,
  })
  .superRefine((d, ctx) => {
    if (d.typeReponse === "CHOIX") {
      if (d.choix.length < 2) ctx.addIssue({ code: "custom", message: "Au moins deux choix", path: ["choix"] });
      if (!d.choix.includes(d.bonneReponse)) {
        ctx.addIssue({ code: "custom", message: "bonneReponse doit être l'un des choix", path: ["bonneReponse"] });
      }
      return;
    }
    for (const message of verifierQuestionSurFigure(d.typeReponse, d.figure, d.reponseAttendue)) {
      ctx.addIssue({ code: "custom", message, path: ["reponseAttendue"] });
    }
  })
  .transform((d) =>
    d.typeReponse === "CHOIX" || !d.reponseAttendue
      ? { ...d, reponseAttendue: undefined }
      : { ...d, choix: [], bonneReponse: libelleReponseAttendue(d.reponseAttendue) }
  );

export const updateQcmSchema = z.object({
  enonce: z.string().min(1).optional(),
  /** Réponse sur figure : position/valeur attendue et tolérance (vérifiée avec la figure en service). */
  reponseAttendue: reponseAttendueSchema.optional(),
  choix: z.array(z.string().min(1)).min(2).optional(),
  bonneReponse: z.string().min(1).optional(),
  difficulte: difficulteEnum.optional(),
  statut: statutEnum.optional(),
  notionIds: z.array(z.string().cuid()).optional(),
  figure: figureOptionnelleSchema,
});

export const generateQcmIaSchema = z.object({
  nombreQuestions: z.number().int().min(1).max(20).default(5),
});

export const generateVariantesSchema = z.object({
  nombre: z.number().int().min(1).max(5).default(3),
});

export const createSaisieLibreSchema = z.object({
  enonce: z.string().min(1),
  reponseReference: z.string().min(1),
  notionIds: z.array(z.string().cuid()).min(1),
  figure: figureOptionnelleSchema,
});

export const updateSaisieLibreSchema = z.object({
  enonce: z.string().min(1).optional(),
  reponseReference: z.string().min(1).optional(),
  statut: statutEnum.optional(),
  notionIds: z.array(z.string().cuid()).optional(),
  figure: figureOptionnelleSchema,
});

export const generateSaisieLibreIaSchema = z.object({
  nombreQuestions: z.number().int().min(1).max(20).default(5),
});
