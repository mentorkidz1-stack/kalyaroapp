import { describe, expect, it } from "vitest";
import { generateQcmVariantsOutputSchema } from "@kalyaro/ai-service";

const variante = {
  enonce: "Un commerçant de Dantokpa vend 12 pagnes à 3 500 F. Quelle est sa recette ?",
  choix: ["42 000 F", "40 500 F", "15 500 F", "36 000 F"],
  bonneReponse: "42 000 F",
};

describe("schéma de sortie des variantes IA", () => {
  it("accepte une variante cohérente", () => {
    expect(generateQcmVariantsOutputSchema.safeParse({ variantes: [variante] }).success).toBe(true);
  });

  it("refuse une bonne réponse absente des choix", () => {
    const r = generateQcmVariantsOutputSchema.safeParse({ variantes: [{ ...variante, bonneReponse: "42000 F" }] });
    expect(r.success).toBe(false);
  });

  it("refuse des choix en double", () => {
    const r = generateQcmVariantsOutputSchema.safeParse({
      variantes: [{ ...variante, choix: ["42 000 F", "42 000 F", "15 500 F", "36 000 F"] }],
    });
    expect(r.success).toBe(false);
  });

  it("exige exactement 4 choix", () => {
    const r = generateQcmVariantsOutputSchema.safeParse({ variantes: [{ ...variante, choix: ["42 000 F", "40 500 F"] }] });
    expect(r.success).toBe(false);
  });
});
