import { z } from "zod";

export const chapitreIdParamSchema = z.object({ chapitreId: z.string().cuid() });
export const notionIdParamSchema = z.object({ notionId: z.string().cuid() });
export const diagnosticIdParamSchema = z.object({ id: z.string().cuid() });
export const matiereIdParamSchema = z.object({ matiereId: z.string().cuid() });

export const submitQcmAnswerSchema = z.object({
  attemptToken: z.string().min(1),
  reponseDonnee: z.string().min(1),
});

export const submitFreeAnswerSchema = z.object({
  questionSaisieLibreId: z.string().cuid(),
  reponseDonnee: z.string().min(1),
});

export const submitDiagnosticInitialSchema = z.object({
  reponses: z.array(
    z.object({
      notionNom: z.string(),
      reponseDonnee: z.string(),
    })
  ),
});

export const submitMetacognitiveAnswerSchema = z.object({
  questionMetacognitiveId: z.string().cuid(),
  tentativeId: z.string().cuid(),
  reponseTexte: z.string().min(1),
});

export const epreuveIdParamSchema = z.object({ id: z.string().cuid() });
export const submitEpreuveSchema = z.object({ reponseDonnee: z.string().min(1) });
export const advanceDiagnosticSchema = z.object({ correcte: z.boolean() });
