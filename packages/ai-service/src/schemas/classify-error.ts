import { z } from "zod";

/** Causes d'erreur du cahier d'erreurs (chantier 3.2). */
export const TYPES_ERREUR = ["CONNAISSANCE", "CONFUSION", "PROCEDURE", "LECTURE_ENONCE", "CALCUL", "METHODE", "REDACTION"] as const;
export type TypeErreur = (typeof TYPES_ERREUR)[number];

export const classifyErrorInputSchema = z.object({
  parcours: z.enum(["SCOLAIRE", "UNIVERSITAIRE"]),
  notionNom: z.string(),
  /** QCM, réponse sur figure, réponse rédigée (saisie libre ou épreuve). */
  format: z.enum(["QCM", "REDIGEE"]),
  question: z.string(),
  /** Choix proposés (QCM). */
  choix: z.array(z.string()).optional(),
  /** Bonne réponse ou corrigé de référence (jamais montré à l'élève par cette fonction). */
  reponseAttendue: z.string(),
  reponseEleve: z.string(),
});
export type ClassifyErrorInput = z.infer<typeof classifyErrorInputSchema>;

export const classifyErrorOutputSchema = z.object({
  typeErreur: z.enum(TYPES_ERREUR),
  /** Une phrase adressée à l'élève : ce qui, dans sa réponse, montre ce type d'erreur. */
  explication: z.string().min(1),
});
export type ClassifyErrorOutput = z.infer<typeof classifyErrorOutputSchema>;
