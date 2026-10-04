// Test d'intégration du chantier 2.1 : vrai code et vraie base PostgreSQL, IA simulée.
// Ignoré par défaut (npm test reste sans base). Pour le lancer, sur une base de DÉVELOPPEMENT
// fraîchement remplie par le seed (il modifie l'épreuve « Partiel L1 ») :
//   INTEGRATION_DATABASE_URL="postgresql://…/kalyaro" npx vitest run src/modules/passages/passages.integration.test.ts
import { afterAll, describe, expect, it, vi } from "vitest";

const urlBase = process.env.INTEGRATION_DATABASE_URL;
if (urlBase) process.env.DATABASE_URL = urlBase;

vi.mock("@kalyaro/ai-service", () => ({
  // La « copie » contient la note voulue : "PTS:3.5 …"
  gradeExamAnswer: vi.fn(async (input: { reponseEtudiant: string; pointsMax: number }) => {
    const pts = Number(/PTS:([\d.]+)/.exec(input.reponseEtudiant)?.[1] ?? 0);
    return { pointsObtenus: pts, explication: `Noté ${pts}/${input.pointsMax}.`, elementsReussis: ["méthode"], elementsManquants: pts < input.pointsMax ? ["résultat"] : [] };
  }),
  diagnosePrerequisite: vi.fn(async (input: { prerequisDirects: { nom: string }[] }) => ({
    prerequisSuspecte: input.prerequisDirects[0]!.nom,
    justification: "simulé",
  })),
  proposeExamSplit: vi.fn(async () => ({
    questions: [
      { numero: "1", enonce: "Exprime π(q).", points: 6, notion: "optimisation ECONOMIQUE" },
      { numero: "2", enonce: "Détermine q*.", points: 8, notion: "Inexistante" },
      { numero: "3", enonce: "Profit maximal.", points: 4, notion: null },
    ],
  })),
  generateAnswerKey: vi.fn(),
  AiGenerationError: class extends Error {},
}));

describe.skipIf(!urlBase)("chantier 2.1 — bout en bout (base locale, IA simulée)", async () => {
  if (!urlBase) return;
  const { prisma } = await import("../../db/prisma.js");
  const exams = await import("../exams/exams.service.js");
  const passages = await import("./passages.service.js");

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@kalyaro.bj" } });
  const etudiant = await prisma.user.findUniqueOrThrow({ where: { email: "etudiant.demo@kalyaro.bj" } });
  const partiel = await prisma.epreuve.findFirstOrThrow({ where: { enonce: { startsWith: "Partiel L1" } } });
  const examStats = await prisma.epreuve.findFirstOrThrow({ where: { enonce: { startsWith: "Examen de fin de semestre" } } });
  const notion = (nom: string) => prisma.notion.findFirstOrThrow({ where: { nom } });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("admin : propose un découpage IA, notions rattachées sans tenir compte des accents/majuscules", async () => {
    const p = await exams.proposerDecoupage(partiel.id, 20);
    const optim = await notion("Optimisation économique");
    expect(p.questions.map((q) => q.notionId)).toEqual([optim.id, null, null]);
    expect(p.totalPoints).toBe(18);
    expect(p.avertissement).toMatch(/18.*20/);
  });

  it("épreuve de 4 questions notée sur 20 → note sur 20, détail par question et par notion", async () => {
    await prisma.epreuve.update({ where: { id: partiel.id }, data: { bareme: 20, annee: 2025, session: "Session normale", examen: "Partiel L1" } });
    const [fonctions, derivees, optim] = await Promise.all([notion("Fonctions usuelles"), notion("Calcul de dérivées"), notion("Optimisation économique")]);
    const { questions } = await exams.remplacerQuestionsEpreuve(partiel.id, [
      { numero: "1", enonce: "Calcule C(10).", points: 4, notionId: fonctions.id },
      { numero: "2.a", enonce: "Exprime π(q).", points: 6, notionId: derivees.id },
      { numero: "2.b", enonce: "Calcule π'(q).", points: 4, notionId: derivees.id },
      { numero: "3", enonce: "Détermine q* et le profit maximal.", points: 6, notionId: optim.id },
    ]);
    expect(questions.map((q) => q.numero)).toEqual(["1", "2.a", "2.b", "3"]);

    // Sans corrigé validé pour chaque question, l'épreuve n'est pas proposée aux étudiants.
    const avant = await passages.listEpreuvesPourEtudiant(etudiant.id, partiel.matiereId);
    expect(avant.find((e) => e.id === partiel.id)).toBeUndefined();

    for (const q of questions) await exams.createCorrigeQuestion(q.id, admin.id, { contenu: `Corrigé ${q.numero}`, estPrincipal: true });
    // Un corrigé IA en attente ne débloque rien et n'est jamais utilisé pour noter.
    await prisma.corrigeQuestionEpreuve.create({ data: { questionEpreuveId: questions[0]!.id, contenu: "IA non relue", statutValidation: "A_VALIDER", createdById: admin.id } });

    const liste = await passages.listEpreuvesPourEtudiant(etudiant.id, partiel.matiereId);
    const carte = liste.find((e) => e.id === partiel.id)!;
    expect(carte).toMatchObject({ nbQuestions: 4, bareme: 20, decoupee: true, examen: "Partiel L1", annee: 2025 });

    const passage = await passages.demarrerPassage(etudiant.id, partiel.id);
    expect(JSON.stringify(passage)).not.toContain("Corrigé");
    expect(passage.questions).toHaveLength(4);

    const notes = { "1": "4", "2.a": "3.5", "2.b": "1", "3": "2.3" }; // 2,3 → arrondi à 2,25
    const resultats = [];
    for (const q of passage.questions) {
      resultats.push(await passages.repondreQuestion(etudiant.id, passage.passageId, q.cle, `PTS:${notes[q.numero as keyof typeof notes]} ma copie`));
    }
    expect(resultats.map((r) => [r.pointsObtenus, r.ratee])).toEqual([[4, false], [3.5, false], [1, true], [2.25, true]]);

    // Question 3 ratée → descente diagnostique sur SA notion (Optimisation économique).
    const diag = resultats[3]!.diagnostic!;
    expect(diag.notionASonder.nom).toBe("Sens de variation");
    const d = await prisma.diagnosticPrerequis.findUniqueOrThrow({ where: { id: diag.diagnosticId } });
    expect(d.notionDeclenchanteId).toBe(optim.id);

    await expect(passages.repondreQuestion(etudiant.id, passage.passageId, passage.questions[0]!.cle, "PTS:4")).rejects.toThrow(/déjà répondu/);

    const rapport = await passages.terminerPassage(etudiant.id, passage.passageId);
    expect(rapport.note).toBe(10.75);
    expect(rapport.noteSur20).toBe(10.75);
    expect(rapport.parNotion.map((n) => [n.notionNom, n.pointsPerdus])).toEqual([
      ["Calcul de dérivées", 5.5],
      ["Optimisation économique", 3.75],
      ["Fonctions usuelles", 0],
    ]);
    const enBase = await prisma.passageEpreuve.findUniqueOrThrow({ where: { id: passage.passageId } });
    expect([enBase.pointsObtenus, enBase.bareme, enBase.termineAt !== null]).toEqual([10.75, 20, true]);
    await expect(passages.repondreQuestion(etudiant.id, passage.passageId, passage.questions[1]!.cle, "PTS:6")).rejects.toThrow(/terminé/);

    const listeApres = await passages.listEpreuvesPourEtudiant(etudiant.id, partiel.matiereId);
    expect(listeApres.find((e) => e.id === partiel.id)!.dernierPassage).toMatchObject({ note: 10.75, bareme: 20 });
  });

  it("compatibilité : une épreuve non découpée est passée comme une question unique", async () => {
    const passage = await passages.demarrerPassage(etudiant.id, examStats.id);
    expect(passage.epreuve.decoupee).toBe(false);
    expect(passage.questions).toEqual([expect.objectContaining({ cle: "unique", numero: "1", points: 20, notionNom: "Variance et écart-type" })]);
    const r = await passages.repondreQuestion(etudiant.id, passage.passageId, "unique", "PTS:14.6 ma copie");
    expect(r.pointsObtenus).toBe(14.5);
    const rapport = await passages.terminerPassage(etudiant.id, passage.passageId);
    expect([rapport.note, rapport.noteSur20]).toEqual([14.5, 14.5]);
  });

  it("isolation : un autre étudiant ne peut ni lire ni répondre au passage", async () => {
    const autre = await prisma.user.findUniqueOrThrow({ where: { email: "eleve.demo@kalyaro.bj" } });
    const p = await passages.demarrerPassage(etudiant.id, examStats.id);
    await expect(passages.getPassage(autre.id, p.passageId)).rejects.toThrow(/introuvable/);
    await expect(passages.demarrerPassage(autre.id, partiel.id)).rejects.toThrow(/introuvable/);
  });
});
