import { z } from "zod";

export const generateQcmVariantsInputSchema = z.object({
  notionNom: z.string(),
  enonceOriginal: z.string(),
  choixOriginal: z.array(z.string()),
  bonneReponseOriginal: z.string(),
  nombreVariantes: z.number().int().min(1).max(10),
});
export type GenerateQcmVariantsInput = z.infer<typeof generateQcmVariantsInputSchema>;

// Les contrôles de cohérence sont dans le schéma : une variante incohérente fait échouer
// la validation et déclenche une nouvelle tentative de generateStructured, au lieu
// d'arriver telle quelle dans la file de validation.
const varianteSchema = z
  .object({
    enonce: z.string().min(1),
    choix: z.array(z.string().min(1)).length(4),
    bonneReponse: z.string().min(1),
  })
  .refine((v) => v.choix.includes(v.bonneReponse), {
    message: "bonneReponse doit être exactement l'un des 4 choix",
  })
  .refine((v) => new Set(v.choix.map((c) => c.trim())).size === v.choix.length, {
    message: "les 4 choix doivent être tous différents",
  });

export const generateQcmVariantsOutputSchema = z.object({
  variantes: z.array(varianteSchema).min(1),
});
export type GenerateQcmVariantsOutput = z.infer<typeof generateQcmVariantsOutputSchema>;
