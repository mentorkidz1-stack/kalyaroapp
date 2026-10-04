import { describe, expect, it } from "vitest";
import { computeNextProgression, estAcquise, type EtatProgression, type NiveauMaitrise } from "./mastery.js";

// Heures exprimées en UTC ; le Bénin est en UTC+1.
const J0 = new Date("2026-10-06T08:00:00Z"); // 6 octobre, 9 h au Bénin
const at = (iso: string) => new Date(iso);

function etat(partial: Partial<EtatProgression> = {}): EtatProgression {
  return {
    statut: "NON_VU",
    nbEchecsConsecutifs: 0,
    nbSuccesConsecutifs: 0,
    intervalleRevisionJours: 1,
    derniereRevisionAt: null,
    prochaineRevisionAt: null,
    derniereTentativeAt: null,
    ...partial,
  };
}

function enchainer(depart: EtatProgression, reponses: [boolean, Date][]): EtatProgression {
  return reponses.reduce((s, [correcte, now]) => computeNextProgression(s, { correcte, now }), depart);
}

describe("découverte et série du jour", () => {
  it("une première bonne réponse fait passer NON_VU → FRAGILE, révision demain", () => {
    const s = computeNextProgression(etat(), { correcte: true, now: J0 });
    expect(s.statut).toBe("FRAGILE");
    expect(s.nbSuccesConsecutifs).toBe(1);
    expect(s.prochaineRevisionAt).toEqual(at("2026-10-06T23:00:00Z"));
  });

  it("une première erreur fait passer NON_VU → FRAGILE, révision demain", () => {
    const s = computeNextProgression(etat(), { correcte: false, now: J0 });
    expect(s.statut).toBe("FRAGILE");
    expect(s.nbEchecsConsecutifs).toBe(1);
    expect(s.prochaineRevisionAt).toEqual(at("2026-10-06T23:00:00Z"));
  });

  it("3 réussites consécutives le même jour → ACQUIS_DU_JOUR, révision à J+1", () => {
    const s = enchainer(etat(), [
      [true, J0],
      [true, at("2026-10-06T08:01:00Z")],
      [true, at("2026-10-06T08:02:00Z")],
    ]);
    expect(s.statut).toBe("ACQUIS_DU_JOUR");
    expect(s.intervalleRevisionJours).toBe(1);
    expect(s.derniereRevisionAt).toEqual(at("2026-10-06T08:02:00Z"));
    expect(s.prochaineRevisionAt).toEqual(at("2026-10-06T23:00:00Z"));
  });

  it("une série répartie sur deux jours repart de zéro : pas d'ACQUIS_DU_JOUR", () => {
    const s = enchainer(etat(), [
      [true, at("2026-10-06T20:00:00Z")], // 21 h le 6
      [true, at("2026-10-06T21:00:00Z")], // 22 h le 6
      [true, at("2026-10-06T23:30:00Z")], // 0 h 30 le 7
    ]);
    expect(s.statut).toBe("FRAGILE");
    expect(s.nbSuccesConsecutifs).toBe(1);
  });

  it("une erreur au milieu de la série la remet à zéro", () => {
    const s = enchainer(etat(), [
      [true, J0],
      [true, J0],
      [false, J0],
      [true, J0],
      [true, J0],
    ]);
    expect(s.statut).toBe("FRAGILE");
    expect(s.nbSuccesConsecutifs).toBe(2);
  });
});

describe("révisions espacées", () => {
  const acquis = etat({
    statut: "ACQUIS_DU_JOUR",
    nbSuccesConsecutifs: 3,
    intervalleRevisionJours: 1,
    derniereRevisionAt: J0,
    prochaineRevisionAt: at("2026-10-06T23:00:00Z"),
    derniereTentativeAt: J0,
  });

  it("une bonne réponse le jour même, avant l'échéance, est un entraînement : niveau inchangé", () => {
    const s = computeNextProgression(acquis, { correcte: true, now: at("2026-10-06T15:00:00Z") });
    expect(s.statut).toBe("ACQUIS_DU_JOUR");
    expect(s.prochaineRevisionAt).toEqual(acquis.prochaineRevisionAt);
    expect(s.intervalleRevisionJours).toBe(1);
  });

  it("révision réussie à J+1 → CONSOLIDE, intervalle doublé", () => {
    const s = computeNextProgression(acquis, { correcte: true, now: at("2026-10-07T07:00:00Z") });
    expect(s.statut).toBe("CONSOLIDE");
    expect(s.intervalleRevisionJours).toBe(2);
    expect(s.prochaineRevisionAt).toEqual(at("2026-10-08T23:00:00Z"));
  });

  it("révision réussie mais à moins de 7 jours de la précédente : reste CONSOLIDE", () => {
    const consolide = etat({
      statut: "CONSOLIDE",
      intervalleRevisionJours: 2,
      derniereRevisionAt: at("2026-10-07T07:00:00Z"),
      prochaineRevisionAt: at("2026-10-08T23:00:00Z"),
    });
    const s = computeNextProgression(consolide, { correcte: true, now: at("2026-10-09T07:00:00Z") });
    expect(s.statut).toBe("CONSOLIDE");
    expect(s.intervalleRevisionJours).toBe(4);
  });

  it("révision réussie à ≥ 7 jours de la précédente → DURABLE", () => {
    const consolide = etat({
      statut: "CONSOLIDE",
      intervalleRevisionJours: 8,
      derniereRevisionAt: at("2026-10-06T07:00:00Z"),
      prochaineRevisionAt: at("2026-10-13T23:00:00Z"),
    });
    const s = computeNextProgression(consolide, { correcte: true, now: at("2026-10-14T07:00:00Z") });
    expect(s.statut).toBe("DURABLE");
    expect(s.intervalleRevisionJours).toBe(16);
  });

  it("révision réussie d'une notion DURABLE : reste DURABLE, intervalle plafonné à 30 jours", () => {
    const durable = etat({
      statut: "DURABLE",
      intervalleRevisionJours: 16,
      derniereRevisionAt: at("2026-10-01T07:00:00Z"),
      prochaineRevisionAt: at("2026-10-16T23:00:00Z"),
    });
    const s = computeNextProgression(durable, { correcte: true, now: at("2026-10-17T07:00:00Z") });
    expect(s.statut).toBe("DURABLE");
    expect(s.intervalleRevisionJours).toBe(30);
  });
});

describe("échecs : descente d'un seul niveau", () => {
  const cas: [NiveauMaitrise, NiveauMaitrise][] = [
    ["DURABLE", "CONSOLIDE"],
    ["CONSOLIDE", "ACQUIS_DU_JOUR"],
    ["ACQUIS_DU_JOUR", "FRAGILE"],
    ["FRAGILE", "FRAGILE"],
  ];
  for (const [avant, apres] of cas) {
    it(`${avant} → ${apres}, intervalle remis à 1 jour, révision demain`, () => {
      const s = computeNextProgression(
        etat({
          statut: avant,
          intervalleRevisionJours: 16,
          nbSuccesConsecutifs: 5,
          derniereRevisionAt: at("2026-09-20T07:00:00Z"),
          prochaineRevisionAt: at("2026-10-05T23:00:00Z"),
        }),
        { correcte: false, now: J0 }
      );
      expect(s.statut).toBe(apres);
      expect(s.intervalleRevisionJours).toBe(1);
      expect(s.nbSuccesConsecutifs).toBe(0);
      expect(s.prochaineRevisionAt).toEqual(at("2026-10-06T23:00:00Z"));
    });
  }

  it("après une descente DURABLE → CONSOLIDE, la révision réussie du lendemain reste CONSOLIDE", () => {
    const s = enchainer(
      etat({
        statut: "DURABLE",
        intervalleRevisionJours: 16,
        derniereRevisionAt: at("2026-09-20T07:00:00Z"),
        prochaineRevisionAt: at("2026-10-05T23:00:00Z"),
      }),
      [
        [false, J0],
        [true, at("2026-10-07T07:00:00Z")],
      ]
    );
    expect(s.statut).toBe("CONSOLIDE");
    expect(s.intervalleRevisionJours).toBe(2);
  });
});

describe("garanties", () => {
  it("aucune notion n'atteint DURABLE le jour de sa découverte, quel que soit l'enchaînement", () => {
    let s = etat();
    for (let minute = 0; minute < 300; minute++) {
      const now = new Date(J0.getTime() + minute * 60_000);
      s = computeNextProgression(s, { correcte: minute % 17 !== 5, now });
      expect(s.statut).not.toBe("DURABLE");
      expect(s.statut).not.toBe("CONSOLIDE");
    }
  });

  it("le chemin le plus rapide vers DURABLE prend au moins 7 jours", () => {
    let s = enchainer(etat(), [
      [true, J0],
      [true, J0],
      [true, J0],
    ]);
    let jours = 0;
    while (s.statut !== "DURABLE") {
      const now = s.prochaineRevisionAt!;
      s = computeNextProgression(s, { correcte: true, now });
      jours = Math.round((now.getTime() - J0.getTime()) / 86_400_000);
    }
    expect(jours).toBeGreaterThanOrEqual(7);
  });

  it("estAcquise débloque à partir d'ACQUIS_DU_JOUR", () => {
    expect(estAcquise(undefined)).toBe(false);
    expect(estAcquise("NON_VU")).toBe(false);
    expect(estAcquise("FRAGILE")).toBe(false);
    expect(estAcquise("ACQUIS_DU_JOUR")).toBe(true);
    expect(estAcquise("CONSOLIDE")).toBe(true);
    expect(estAcquise("DURABLE")).toBe(true);
  });
});
