import { describe, expect, it } from "vitest";
import {
  DELAI_GRACE_MS,
  TEMPS_MAX_PAR_ENREGISTREMENT_S,
  analyserTemps,
  dateLimitePassage,
  deltaTempsValide,
  estExpire,
  finExamen,
  fusionnerTranscriptions,
  reponseFinale,
  notionsPrioritaires,
} from "./examen.js";

describe("chronomètre", () => {
  const debut = new Date("2026-10-20T08:00:00Z");

  it("l'heure limite est le début + la durée de l'épreuve (60 min par défaut)", () => {
    expect(dateLimitePassage(debut, 90)).toEqual(new Date("2026-10-20T09:30:00Z"));
    expect(dateLimitePassage(debut, null)).toEqual(new Date("2026-10-20T09:00:00Z"));
  });

  it("n'est expiré qu'après l'heure limite plus la marge réseau", () => {
    const limite = new Date("2026-10-20T09:30:00Z");
    expect(estExpire(new Date("2026-10-20T09:29:59Z"), limite)).toBe(false);
    expect(estExpire(new Date("2026-10-20T09:30:01Z"), limite)).toBe(true);
    expect(estExpire(new Date("2026-10-20T09:30:20Z"), limite, DELAI_GRACE_MS)).toBe(false);
    expect(estExpire(new Date("2026-10-20T09:30:31Z"), limite, DELAI_GRACE_MS)).toBe(true);
    expect(estExpire(new Date(), null)).toBe(false);
  });
});

describe("deltaTempsValide", () => {
  it("borne le temps crédité par enregistrement", () => {
    expect(deltaTempsValide(25.4)).toBe(25);
    expect(deltaTempsValide(-5)).toBe(0);
    expect(deltaTempsValide(Number.NaN)).toBe(0);
    expect(deltaTempsValide(10_000)).toBe(TEMPS_MAX_PAR_ENREGISTREMENT_S);
  });
});

describe("analyserTemps", () => {
  it("répartit la durée au prorata des points et classe le temps passé", () => {
    // 90 min pour 20 points : 4,5 min par point.
    const a = analyserTemps(
      [
        { cle: "q1", numero: "1", points: 4 }, // conseillé 18 min
        { cle: "q2", numero: "2", points: 10 }, // conseillé 45 min
        { cle: "q3", numero: "3", points: 6 }, // conseillé 27 min
        { cle: "q4", numero: "4", points: 0 },
      ],
      { q1: 30 * 60, q2: 40 * 60, q3: 10 * 60 },
      90
    );
    expect(a.dureeSecondes).toBe(5400);
    expect(a.tempsTotalSecondes).toBe(80 * 60);
    expect(a.parQuestion.map((q) => [q.numero, q.tempsConseilleSecondes / 60, q.statut])).toEqual([
      ["1", 18, "trop_long"], // 30 min > 27 min (1,5 × 18)
      ["2", 45, "dans_le_temps"],
      ["3", 27, "rapide"], // 10 min < 13,5 min
      ["4", 0, "non_abordee"],
    ]);
  });
});

describe("copie papier photographiée", () => {
  const limite = new Date("2026-10-20T09:30:00Z");

  it("laisse 10 minutes pour photographier après l'heure limite, 30 s sinon", () => {
    expect(finExamen({ dateLimiteAt: limite, copiePapier: true })).toEqual(new Date("2026-10-20T09:40:00Z"));
    expect(finExamen({ dateLimiteAt: limite, copiePapier: false })).toEqual(new Date(limite.getTime() + DELAI_GRACE_MS));
    expect(finExamen({ dateLimiteAt: null, copiePapier: true })).toBeNull();
  });

  it("ajoute les pages lues aux transcriptions existantes, sans texte vide", () => {
    expect(
      fusionnerTranscriptions({ q1: "π(q) = −q² + 80q − 300" }, [
        { cle: "q1", texte: "(suite) donc π est un polynôme" },
        { cle: "q2", texte: "q* = 40" },
        { cle: "q3", texte: "   " },
      ])
    ).toEqual({ q1: "π(q) = −q² + 80q − 300\n(suite) donc π est un polynôme", q2: "q* = 40" });
  });

  it("la réponse corrigée combine le texte tapé et la photo", () => {
    expect(reponseFinale("q* = 40", undefined)).toEqual({ texte: "q* = 40", depuisPhoto: false });
    expect(reponseFinale("", "q* = 40")).toEqual({ texte: "q* = 40", depuisPhoto: true });
    expect(reponseFinale("début tapé", "suite photographiée")).toEqual({ texte: "début tapé\n\nsuite photographiée", depuisPhoto: true });
    expect(reponseFinale("  ", undefined)).toEqual({ texte: "", depuisPhoto: false });
  });
});

describe("notionsPrioritaires", () => {
  it("garde les 3 notions qui ont coûté le plus de points, rattachées à une notion", () => {
    const r = notionsPrioritaires([
      { notionId: "a", pointsPerdus: 2 },
      { notionId: null, pointsPerdus: 9 },
      { notionId: "b", pointsPerdus: 5 },
      { notionId: "c", pointsPerdus: 0 },
      { notionId: "d", pointsPerdus: 1 },
      { notionId: "e", pointsPerdus: 3 },
    ]);
    expect(r.map((n) => n.notionId)).toEqual(["b", "e", "a"]);
  });
});
