import { z } from "zod";

export const diagnosePrerequisiteInputSchema = z.object({
  notionEnEchecNom: z.string(),
  notionEnEchecDescription: z.string(),
  prerequisDirects: z.array(z.object({ nom: z.string(), description: z.string() })).min(1),
  reponseEleve: z.string(),
  contexteEchec: z.string(),
});
export type DiagnosePrerequisiteInput = z.infer<typeof diagnosePrerequisiteInputSchema>;

/** Schéma de sortie construit dynamiquement : `prerequisSuspecte` doit être l'un des
 * noms de `prerequisDirects` fournis en entrée — Zod rejette (et déclenche la relance
 * automatique) toute notion hallucinée hors de cette liste. */
export function buildDiagnosePrerequisiteOutputSchema(prerequisDirects: { nom: string }[]) {
  const noms = prerequisDirects.map((p) => p.nom) as [string, ...string[]];
  return z.object({
    prerequisSuspecte: z.enum(noms),
    justification: z.string(),
  });
}
export type DiagnosePrerequisiteOutput = z.infer<ReturnType<typeof buildDiagnosePrerequisiteOutputSchema>>;
