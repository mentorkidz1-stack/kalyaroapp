import { z } from "zod";

export const proposePrerequisiteGraphInputSchema = z.object({
  chapitreTitre: z.string(),
  texteCours: z.string(),
});
export type ProposePrerequisiteGraphInput = z.infer<typeof proposePrerequisiteGraphInputSchema>;

export const proposePrerequisiteGraphOutputSchema = z
  .object({
    notions: z.array(z.object({ nom: z.string(), description: z.string() })).min(1),
    prerequisites: z.array(z.object({ notion: z.string(), prerequisDe: z.string() })),
  })
  .refine(
    (data) => {
      const noms = new Set(data.notions.map((n) => n.nom));
      return data.prerequisites.every(
        (p) => noms.has(p.notion) && noms.has(p.prerequisDe) && p.notion !== p.prerequisDe
      );
    },
    {
      message:
        "Chaque arête doit référencer des notions listées dans `notions`, et une notion ne peut pas être son propre prérequis",
    }
  );
export type ProposePrerequisiteGraphOutput = z.infer<typeof proposePrerequisiteGraphOutputSchema>;
