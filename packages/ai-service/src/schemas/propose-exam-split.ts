import { z } from "zod";

export const proposeExamSplitInputSchema = z.object({
  parcours: z.enum(["SCOLAIRE", "UNIVERSITAIRE"]),
  texteEpreuve: z.string().min(1),
  /** Noms des notions de la matière, pour rattacher chaque question. */
  notions: z.array(z.string()),
  /** Barème total visé si le sujet ne l'indique pas (défaut 20). */
  bareme: z.number().positive().optional(),
});
export type ProposeExamSplitInput = z.infer<typeof proposeExamSplitInputSchema>;

export const proposeExamSplitOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        numero: z.string().min(1),
        enonce: z.string().min(1),
        points: z.number().positive(),
        /** Nom EXACT d'une notion fournie, ou null si aucune ne correspond. */
        notion: z.string().nullable(),
        /** Description de figure (validée ensuite par le serveur ; écartée si invalide). */
        figure: z.unknown().nullable().optional(),
      })
    )
    .min(1),
});
export type ProposeExamSplitOutput = z.infer<typeof proposeExamSplitOutputSchema>;
