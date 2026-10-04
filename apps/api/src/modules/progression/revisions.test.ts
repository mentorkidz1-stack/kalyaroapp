import { describe, expect, it } from "vitest";
import {
  DAILY_REVIEW_LIMIT,
  estimerDureeMinutes,
  planifierSeance,
  prochaineRevisionDans,
  trierNotionsDues,
  type NotionDue,
} from "./revisions.js";

// Générateur pseudo-aléatoire déterministe pour des tests reproductibles.
function rngDeterministe(graine = 42) {
  let x = graine;
  return () => {
    x = (x * 1103515245 + 12345) % 2 ** 31;
    return x / 2 ** 31;
  };
}

describe("prochaineRevisionDans", () => {
  it("programme une notion ratée à minuit (heure du Bénin) le lendemain", () => {
    // 21 h 30 au Bénin le 6 octobre = 20 h 30 UTC
    const echec = new Date("2026-10-06T20:30:00Z");
    expect(prochaineRevisionDans(echec, 1)).toEqual(new Date("2026-10-06T23:00:00Z"));
  });

  it("une notion ratée aujourd'hui est due demain matin, pas avant minuit", () => {
    const echec = new Date("2026-10-06T08:00:00Z");
    const prochaine = prochaineRevisionDans(echec, 1);
    expect(prochaine <= new Date("2026-10-07T06:00:00Z")).toBe(true); // demain 7 h au Bénin
    expect(prochaine <= new Date("2026-10-06T22:00:00Z")).toBe(false); // ce soir 23 h au Bénin
  });

  it("gère une tentative faite juste après minuit heure du Bénin (encore la veille en UTC)", () => {
    const echec = new Date("2026-10-06T23:30:00Z"); // 7 octobre, 0 h 30 au Bénin
    expect(prochaineRevisionDans(echec, 1)).toEqual(new Date("2026-10-07T23:00:00Z"));
  });

  it("respecte un intervalle de plusieurs jours", () => {
    expect(prochaineRevisionDans(new Date("2026-10-06T10:00:00Z"), 4)).toEqual(new Date("2026-10-09T23:00:00Z"));
  });
});

function notion(partial: Partial<NotionDue> & { notionId: string }): NotionDue {
  return {
    statut: "FRAGILE",
    nbEchecsConsecutifs: 0,
    dernierEchecAt: null,
    nbEchecsRecents: 0,
    prochaineRevisionAt: new Date("2026-10-06T23:00:00Z"),
    ...partial,
  };
}

describe("trierNotionsDues", () => {
  it("place en premier les erreurs les plus récentes, puis les plus nombreuses", () => {
    const tri = trierNotionsDues([
      notion({ notionId: "ancienne", dernierEchecAt: new Date("2026-10-01T10:00:00Z"), nbEchecsRecents: 9 }),
      notion({ notionId: "hier-1", dernierEchecAt: new Date("2026-10-06T09:00:00Z"), nbEchecsRecents: 1 }),
      notion({ notionId: "hier-4", dernierEchecAt: new Date("2026-10-06T08:00:00Z"), nbEchecsRecents: 4 }),
      notion({ notionId: "jamais-ratee", statut: "MAITRISE" }),
    ]);
    expect(tri.map((n) => n.notionId)).toEqual(["hier-4", "hier-1", "ancienne", "jamais-ratee"]);
  });

  it("départage à égalité par la révision la plus en retard", () => {
    const tri = trierNotionsDues([
      notion({ notionId: "recente", prochaineRevisionAt: new Date("2026-10-06T23:00:00Z") }),
      notion({ notionId: "en-retard", prochaineRevisionAt: new Date("2026-10-02T23:00:00Z") }),
    ]);
    expect(tri.map((n) => n.notionId)).toEqual(["en-retard", "recente"]);
  });
});

describe("planifierSeance", () => {
  it("donne deux questions aux notions fragiles et une aux notions maîtrisées", () => {
    const plan = planifierSeance(
      [
        { notionId: "a", statut: "FRAGILE" },
        { notionId: "b", statut: "MAITRISE" },
        { notionId: "c", statut: "FRAGILE" },
      ],
      DAILY_REVIEW_LIMIT,
      rngDeterministe()
    );
    expect([...plan].sort()).toEqual(["a", "a", "b", "c", "c"]);
  });

  it("s'arrête à 15 questions même s'il reste des notions dues", () => {
    const notions = Array.from({ length: 40 }, (_, i) => ({ notionId: `n${i}`, statut: "FRAGILE" }));
    const plan = planifierSeance(notions, DAILY_REVIEW_LIMIT, rngDeterministe());
    expect(plan).toHaveLength(15);
    // Priorité à la couverture : 15 notions différentes, les 15 premières du tri.
    expect(new Set(plan)).toEqual(new Set(notions.slice(0, 15).map((n) => n.notionId)));
  });

  it("complète avec les deuxièmes questions des fragiles prioritaires quand il reste de la place", () => {
    const notions = Array.from({ length: 10 }, (_, i) => ({ notionId: `n${i}`, statut: "FRAGILE" }));
    const plan = planifierSeance(notions, DAILY_REVIEW_LIMIT, rngDeterministe());
    expect(plan).toHaveLength(15);
    const doublees = notions.map((n) => n.notionId).filter((id) => plan.filter((p) => p === id).length === 2);
    expect(doublees).toEqual(["n0", "n1", "n2", "n3", "n4"]);
  });

  it("mélange les notions sans jamais enchaîner deux questions sur la même", () => {
    for (let graine = 1; graine <= 50; graine++) {
      const plan = planifierSeance(
        [
          { notionId: "a", statut: "FRAGILE" },
          { notionId: "b", statut: "FRAGILE" },
          { notionId: "c", statut: "FRAGILE" },
          { notionId: "d", statut: "MAITRISE" },
        ],
        DAILY_REVIEW_LIMIT,
        rngDeterministe(graine)
      );
      expect(plan).toHaveLength(7);
      for (let i = 1; i < plan.length; i++) expect(plan[i]).not.toBe(plan[i - 1]);
    }
  });

  it("renvoie une séance vide s'il n'y a rien à réviser", () => {
    expect(planifierSeance([])).toEqual([]);
  });
});

describe("estimerDureeMinutes", () => {
  it("estime environ 45 secondes par question, arrondi à la minute supérieure", () => {
    expect(estimerDureeMinutes(0)).toBe(0);
    expect(estimerDureeMinutes(1)).toBe(1);
    expect(estimerDureeMinutes(15)).toBe(12);
  });
});
