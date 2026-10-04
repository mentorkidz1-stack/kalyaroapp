import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { EXEMPLES_FIGURES, EXEMPLE_FIGURE_INVALIDE } from "@kalyaro/shared";
import { figureIaValide, figurePourPrisma } from "./figures.js";
import { createQcmSchema, updateQcmSchema } from "../modules/questions/questions.schemas.js";
import { remplacerQuestionsSchema } from "../modules/exams/exams.schemas.js";

const valide = EXEMPLES_FIGURES[0]!.figure;
const qcm = { enonce: "Calcule BC.", choix: ["5 cm", "7 cm"], bonneReponse: "5 cm", notionIds: ["cmuu64mm30006qsqrs7b17msa"] };

describe("figures côté API", () => {
  it("une question admin avec une figure invalide est refusée (400 Zod), avec une figure valide acceptée", () => {
    expect(createQcmSchema.safeParse({ ...qcm, figure: valide }).success).toBe(true);
    const refus = createQcmSchema.safeParse({ ...qcm, figure: EXEMPLE_FIGURE_INVALIDE });
    expect(refus.success).toBe(false);
    expect(!refus.success && refus.error.issues[0]!.message).toMatch(/Figure invalide/);
    expect(updateQcmSchema.safeParse({ figure: null }).success).toBe(true); // effacer la figure
    expect(remplacerQuestionsSchema.safeParse({ questions: [{ numero: "1", enonce: "x", points: 2, figure: { type: "x" } }] }).success).toBe(false);
  });

  it("une figure générée par l'IA est gardée si valide, écartée sinon (la question reste)", () => {
    expect(figureIaValide(valide)).toBeDefined();
    expect(figureIaValide(EXEMPLE_FIGURE_INVALIDE)).toBeUndefined();
    expect(figureIaValide(null)).toBeUndefined();
    expect(figureIaValide("dessine un triangle")).toBeUndefined();
  });

  it("valeur Prisma : absente = inchangée, null = effacée", () => {
    expect(figurePourPrisma(undefined)).toBeUndefined();
    expect(figurePourPrisma(null)).toBe(Prisma.DbNull);
    expect(figurePourPrisma(valide)).toEqual(valide);
  });
});
