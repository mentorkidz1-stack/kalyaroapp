import { z } from "zod";

export const epreuveIdParamSchema = z.object({ epreuveId: z.string().cuid() });
export const passageIdParamSchema = z.object({ passageId: z.string().cuid() });
export const questionParamSchema = z.object({
  passageId: z.string().cuid(),
  // Id d'une QuestionEpreuve, ou « unique » pour une épreuve non découpée.
  cle: z.union([z.string().cuid(), z.literal("unique")]),
});
export const repondreQuestionSchema = z.object({
  reponseDonnee: z.string().trim().min(1).max(10_000),
});

export const demarrerPassageSchema = z.object({
  mode: z.enum(["ENTRAINEMENT", "EXAMEN_BLANC"]).default("ENTRAINEMENT"),
});

// Brouillon d'examen blanc : texte vide autorisé (l'étudiant peut effacer sa réponse).
export const enregistrerBrouillonSchema = z.object({
  texte: z.string().max(10_000),
  deltaSecondes: z.number().min(0).max(3600).default(0),
});

export const copiePapierSchema = z.object({ actif: z.boolean() });

export const rendreExamenSchema = z.object({
  brouillons: z.record(z.string(), z.string().max(10_000)).optional(),
});
