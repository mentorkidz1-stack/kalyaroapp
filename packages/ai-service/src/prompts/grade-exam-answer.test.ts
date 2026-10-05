import { describe, expect, it } from "vitest";
import { buildGradeExamAnswerPrompt } from "./grade-exam-answer.js";

const base = {
  parcours: "UNIVERSITAIRE" as const,
  numero: "1",
  enonceQuestion: "Calcule la moyenne à partir du tableau.",
  pointsMax: 6,
  corriges: ["234 / 20 = 11,7"],
  reponseEtudiant: "12",
};

describe("buildGradeExamAnswerPrompt — extraits du sujet", () => {
  it("signale au correcteur les images jointes", () => {
    expect(buildGradeExamAnswerPrompt(base, 1).prompt).toContain("L'image jointe est un extrait du sujet");
    expect(buildGradeExamAnswerPrompt(base, 2).prompt).toContain("Les 2 images jointes");
  });
  it("n'en parle pas sans image", () => {
    expect(buildGradeExamAnswerPrompt(base).prompt).not.toContain("image");
  });
});
