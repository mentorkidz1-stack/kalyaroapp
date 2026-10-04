import { describe, expect, it, vi } from "vitest";

// streak.ts importe le client Prisma pour recordDailyActivity ; les fonctions testées
// ici sont pures, on évite donc toute dépendance à une base de données.
vi.mock("../db/prisma.js", () => ({ prisma: {} }));

const { beninDayKey, computeNextStreakCount, projectCurrentStreak } = await import("./streak.js");

describe("beninDayKey", () => {
  it("bascule au jour suivant à minuit heure du Bénin (UTC+1), pas à minuit UTC", () => {
    expect(beninDayKey(new Date("2026-10-05T22:59:00Z"))).toBe("2026-10-05");
    expect(beninDayKey(new Date("2026-10-05T23:00:00Z"))).toBe("2026-10-06");
  });
});

describe("computeNextStreakCount", () => {
  const now = new Date("2026-10-06T10:00:00Z");

  it("démarre la série à 1 pour une première activité", () => {
    expect(computeNextStreakCount(null, 0, now)).toBe(1);
  });

  it("ne change pas la série pour une deuxième activité le même jour", () => {
    expect(computeNextStreakCount(new Date("2026-10-06T07:00:00Z"), 4, now)).toBe(4);
  });

  it("incrémente la série pour une activité le lendemain", () => {
    expect(computeNextStreakCount(new Date("2026-10-05T20:00:00Z"), 4, now)).toBe(5);
  });

  it("repart à 1 après un jour sans activité", () => {
    expect(computeNextStreakCount(new Date("2026-10-04T20:00:00Z"), 4, now)).toBe(1);
  });
});

describe("projectCurrentStreak", () => {
  const now = new Date("2026-10-06T10:00:00Z");

  it("vaut 0 sans aucune activité", () => {
    expect(projectCurrentStreak(3, null, now)).toBe(0);
  });

  it("conserve la série si la dernière activité date d'aujourd'hui ou d'hier", () => {
    expect(projectCurrentStreak(3, new Date("2026-10-06T08:00:00Z"), now)).toBe(3);
    expect(projectCurrentStreak(3, new Date("2026-10-05T08:00:00Z"), now)).toBe(3);
  });

  it("affiche 0 si la série est rompue, sans attendre la prochaine activité", () => {
    expect(projectCurrentStreak(3, new Date("2026-10-04T08:00:00Z"), now)).toBe(0);
  });
});
