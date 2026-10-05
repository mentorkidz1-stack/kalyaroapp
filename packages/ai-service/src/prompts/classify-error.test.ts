import { describe, expect, it } from "vitest";
import { buildClassifyErrorPrompt } from "./classify-error.js";
import { classifyErrorOutputSchema, TYPES_ERREUR } from "../schemas/classify-error.js";

describe("classifyError — prompt et schéma", () => {
  it("décrit les 7 causes et transmet la réponse de l'élève", () => {
    const { system, prompt } = buildClassifyErrorPrompt({
      parcours: "UNIVERSITAIRE",
      notionNom: "Médiane",
      format: "QCM",
      question: "Médiane de 3 ; 7 ; 9 ; 12 ; 20 ?",
      choix: ["9", "10,2"],
      reponseAttendue: "9",
      reponseEleve: "10,2",
    });
    for (const t of TYPES_ERREUR) expect(system).toContain(t);
    expect(system).toContain("étudiant");
    expect(prompt).toContain("Choix proposés : 9 / 10,2");
    expect(prompt).toContain("Réponse de l'élève (fausse) : 10,2");
  });

  it("refuse une cause inventée", () => {
    expect(classifyErrorOutputSchema.safeParse({ typeErreur: "FATIGUE", explication: "…" }).success).toBe(false);
    expect(classifyErrorOutputSchema.safeParse({ typeErreur: "CALCUL", explication: "Erreur de signe." }).success).toBe(true);
  });
});
