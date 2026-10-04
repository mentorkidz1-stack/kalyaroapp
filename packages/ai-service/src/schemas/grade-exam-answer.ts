import { z } from "zod";

export const gradeExamAnswerInputSchema = z.object({
  parcours: z.enum(["SCOLAIRE", "UNIVERSITAIRE"]),
  /** Sujet complet de l'épreuve (données communes aux questions), si la question en dépend. */
  contexteEpreuve: z.string().optional(),
  numero: z.string(),
  enonceQuestion: z.string(),
  pointsMax: z.number().positive(),
  /** Corrigés VALIDÉS par un humain — plusieurs démarches correctes possibles. */
  corriges: z.array(z.string()).min(1),
  reponseEtudiant: z.string(),
  /** La réponse est la transcription IA d'une copie manuscrite photographiée. */
  depuisPhoto: z.boolean().optional(),
});
export type GradeExamAnswerInput = z.infer<typeof gradeExamAnswerInputSchema>;

export const gradeExamAnswerOutputSchema = z.object({
  pointsObtenus: z.number().min(0),
  explication: z.string().min(1),
  elementsReussis: z.array(z.string()),
  elementsManquants: z.array(z.string()),
});
export type GradeExamAnswerOutput = z.infer<typeof gradeExamAnswerOutputSchema>;
