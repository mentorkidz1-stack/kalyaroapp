// Test d'intégration des chantiers 2.1 et 2.2 (épreuves par question, examen blanc) : vrai code et vraie
// base PostgreSQL, IA simulée. Ignoré par défaut (npm test reste sans base). Pour le lancer, sur une base
// fraîchement remplie par le seed (il modifie l'épreuve « Partiel L1 ») :
//   INTEGRATION_DATABASE_URL="postgresql://…/kalyaro" npx vitest run src/modules/passages/passages.integration.test.ts
import { afterAll, describe, expect, it, vi } from "vitest";

const urlBase = process.env.INTEGRATION_DATABASE_URL;
if (urlBase) process.env.DATABASE_URL = urlBase;

const ia = vi.hoisted(() => ({ enPanne: false }));

vi.mock("@kalyaro/ai-service", () => ({
  // La « copie » contient la note voulue : "PTS:3.5 …"
  gradeExamAnswer: vi.fn(async (input: { reponseEtudiant: string; pointsMax: number }) => {
    if (ia.enPanne && input.reponseEtudiant.includes("PANNE")) throw new Error("IA indisponible (simulé)");
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
  // La « photo » est un texte « 1=PTS:4 ma réponse|2=… » ; « ILLISIBLE » simule une photo floue.
  transcribeHandwrittenAnswer: vi.fn(async (_input: unknown, images: { base64: string }[]) => {
    const texte = images.map((i) => Buffer.from(i.base64, "base64").toString("utf8")).join("|");
    if (texte.includes("ILLISIBLE")) return { lisible: false, questions: [], remarque: "Photo floue : reprends-la à la lumière." };
    const questions = texte.split("|").map((part) => {
      const [numero, ...reste] = part.split("=");
      return { numero: numero!.trim(), transcription: reste.join("=") };
    });
    return { lisible: true, questions, remarque: null };
  }),
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

  // ---- Chantier 2.2 : examen blanc (s'appuie sur le découpage du Partiel L1 fait plus haut) ----

  it("examen blanc : chronomètre, pas de correction avant la fin, reprise du même examen", async () => {
    await prisma.epreuve.update({ where: { id: partiel.id }, data: { dureeMinutes: 90 } });
    const avant = Date.now();
    const p = await passages.demarrerPassage(etudiant.id, partiel.id, "EXAMEN_BLANC");
    expect(p.mode).toBe("EXAMEN_BLANC");
    const limite = new Date(p.examen!.dateLimiteAt!).getTime();
    expect(limite - avant).toBeGreaterThanOrEqual(90 * 60_000 - 1000);
    expect(limite - avant).toBeLessThan(90 * 60_000 + 5000);
    expect(p.reponses).toEqual({});

    await expect(passages.repondreQuestion(etudiant.id, p.passageId, p.questions[0]!.cle, "PTS:4")).rejects.toThrow(/remise de la copie/);
    const encore = await passages.demarrerPassage(etudiant.id, partiel.id, "EXAMEN_BLANC");
    expect(encore.passageId).toBe(p.passageId);
  });

  it("examen blanc : brouillons enregistrés sans s'écraser, remise, correction groupée, rapport et révisions", async () => {
    const p = await passages.demarrerPassage(etudiant.id, partiel.id, "EXAMEN_BLANC");
    const [q1, q2, q3, q4] = p.questions;
    // Deux enregistrements simultanés sur deux questions : aucun ne doit écraser l'autre.
    await Promise.all([
      passages.enregistrerBrouillon(etudiant.id, p.passageId, q1!.cle, "PTS:4 brouillon", 300),
      passages.enregistrerBrouillon(etudiant.id, p.passageId, q2!.cle, "PTS:1 brouillon", 50),
    ]);
    await passages.enregistrerBrouillon(etudiant.id, p.passageId, q2!.cle, "PTS:5 version finale", 40);
    const repris = await passages.getPassage(etudiant.id, p.passageId);
    expect(repris.examen!.brouillons).toEqual({ [q1!.cle]: "PTS:4 brouillon", [q2!.cle]: "PTS:5 version finale" });
    expect(repris.reponses).toEqual({});

    // Remise : le dernier état envoyé par le client complète les brouillons ; q4 laissée vide.
    const rapport = await passages.rendreExamen(etudiant.id, p.passageId, { [q3!.cle]: "PTS:1 rendue à la fin", [q4!.cle]: "  " });
    expect(rapport.termine).toBe(true);
    expect(rapport.correctionIncomplete).toBe(false);
    expect(rapport.parQuestion.map((q) => [q.numero, q.pointsObtenus, q.repondue])).toEqual([
      ["1", 4, true],
      ["2.a", 5, true],
      ["2.b", 1, true],
      ["3", 0, false],
    ]);
    expect(rapport.note).toBe(10);
    // Temps : 300 s plafonnés à 120 s par enregistrement ; 50 + 40 s pour q2.
    expect(rapport.temps!.parQuestion.map((t) => [t.numero, t.tempsSecondes, t.tempsConseilleSecondes])).toEqual([
      ["1", 120, 1080],
      ["2.a", 90, 1620],
      ["2.b", 0, 1080],
      ["3", 0, 1620],
    ]);
    // Notions prioritaires = celles qui ont coûté le plus de points, mises en révision immédiate.
    expect(rapport.notionsPrioritaires.map((n) => [n.notionNom, n.pointsPerdus])).toEqual([
      ["Optimisation économique", 6],
      ["Calcul de dérivées", 4],
    ]);
    const progressions = await prisma.progressionNotion.findMany({
      where: { eleveId: etudiant.id, notionId: { in: rapport.notionsPrioritaires.map((n) => n.notionId) } },
    });
    expect(progressions).toHaveLength(2);
    for (const pr of progressions) expect(pr.prochaineRevisionAt!.getTime()).toBeLessThanOrEqual(Date.now());

    // Idempotent : une deuxième remise ne recorrige rien ; plus aucun brouillon accepté.
    const encore = await passages.rendreExamen(etudiant.id, p.passageId);
    expect(encore.note).toBe(10);
    expect(await prisma.tentativeEleve.count({ where: { passageId: p.passageId } })).toBe(3);
    await expect(passages.enregistrerBrouillon(etudiant.id, p.passageId, q1!.cle, "trop tard", 5)).rejects.toThrow(/écoulé/);
    const vue = await passages.getPassage(etudiant.id, p.passageId);
    expect(Object.keys(vue.reponses)).toHaveLength(3);
  });

  it("examen blanc abandonné : rendu automatiquement après l'heure limite", async () => {
    const p = await passages.demarrerPassage(etudiant.id, partiel.id, "EXAMEN_BLANC");
    await passages.enregistrerBrouillon(etudiant.id, p.passageId, p.questions[0]!.cle, "PTS:3 seul brouillon", 60);
    await prisma.passageEpreuve.update({ where: { id: p.passageId }, data: { dateLimiteAt: new Date(Date.now() - 60_000) } });
    await expect(passages.enregistrerBrouillon(etudiant.id, p.passageId, p.questions[1]!.cle, "PTS:8", 10)).rejects.toThrow(/écoulé/);
    const vue = await passages.getPassage(etudiant.id, p.passageId);
    expect(vue.termine).toBe(true);
    const rapport = await passages.getRapport(etudiant.id, p.passageId);
    expect(rapport.note).toBe(3);
  });

  it("examen blanc : une panne IA à la correction laisse le rapport incomplet, relançable sans doublon", async () => {
    const p = await passages.demarrerPassage(etudiant.id, partiel.id, "EXAMEN_BLANC");
    ia.enPanne = true;
    const r1 = await passages.rendreExamen(etudiant.id, p.passageId, {
      [p.questions[0]!.cle]: "PTS:4",
      [p.questions[1]!.cle]: "PTS:6 PANNE",
    });
    expect(r1.correctionIncomplete).toBe(true);
    expect((await prisma.passageEpreuve.findUniqueOrThrow({ where: { id: p.passageId } })).pointsObtenus).toBeNull();
    ia.enPanne = false;
    const r2 = await passages.rendreExamen(etudiant.id, p.passageId);
    expect(r2.correctionIncomplete).toBe(false);
    expect(r2.note).toBe(10);
    expect(await prisma.tentativeEleve.count({ where: { passageId: p.passageId } })).toBe(2);
  });

  // ---- Copie papier photographiée ----
  const photo = (texte: string) => ({ buffer: Buffer.from(texte, "utf8"), mimeType: "image/jpeg" as const });

  it("entraînement : réponse en photo transcrite puis notée, photo illisible refusée sans rien enregistrer", async () => {
    const p = await passages.demarrerPassage(etudiant.id, partiel.id);
    const q = p.questions[1]!; // « 2.a »
    await expect(passages.repondreQuestionPhoto(etudiant.id, p.passageId, q.cle, [photo("ILLISIBLE")])).rejects.toThrow(/floue/);
    expect(await prisma.tentativeEleve.count({ where: { passageId: p.passageId } })).toBe(0);

    // Numérotation écrite « Q2.a) » par l'étudiant : rattachée à la question « 2.a ».
    const r = await passages.repondreQuestionPhoto(etudiant.id, p.passageId, q.cle, [photo("Q2.a)=PTS:4.5 π(q) = −q² + 80q − 300")]);
    expect(r.transcription).toBe("PTS:4.5 π(q) = −q² + 80q − 300");
    expect(r.pointsObtenus).toBe(4.5);
    const t = await prisma.tentativeEleve.findFirstOrThrow({ where: { passageId: p.passageId } });
    expect(t.reponseDonnee).toBe("PTS:4.5 π(q) = −q² + 80q − 300");
    expect((t.evaluationIa as { depuisPhoto?: boolean }).depuisPhoto).toBe(true);
    const vue = await passages.getPassage(etudiant.id, p.passageId);
    expect(vue.reponses[q.cle]!.depuisPhoto).toBe(true);
  });

  it("examen blanc sur papier : pages lues à l'envoi, délai photo après l'heure limite, réponse = tapé + photo", async () => {
    const p = await passages.demarrerPassage(etudiant.id, partiel.id, "EXAMEN_BLANC");
    const [q1, q2, q3] = p.questions;
    await expect(passages.ajouterPhotosCopie(etudiant.id, p.passageId, [photo("1=PTS:4")])).rejects.toThrow(/sur papier/);
    const papier = await passages.choisirCopiePapier(etudiant.id, p.passageId, true);
    expect(papier.examen!.copiePapier).toBe(true);

    await passages.enregistrerBrouillon(etudiant.id, p.passageId, q1!.cle, "PTS:1 début tapé", 30);
    const page1 = await passages.ajouterPhotosCopie(etudiant.id, p.passageId, [photo("1=PTS:2 suite sur papier|2.a=PTS:5 dérivée")]);
    expect(page1.nbPages).toBe(1);
    expect(page1.transcriptions).toEqual({ [q1!.cle]: "PTS:2 suite sur papier", [q2!.cle]: "PTS:5 dérivée" });
    await expect(passages.ajouterPhotosCopie(etudiant.id, p.passageId, [photo("ILLISIBLE")])).rejects.toThrow(/floue/);

    // Heure limite dépassée : plus de saisie au clavier, mais encore 10 min pour photographier.
    await prisma.passageEpreuve.update({ where: { id: p.passageId }, data: { dateLimiteAt: new Date(Date.now() - 2 * 60_000) } });
    await expect(passages.enregistrerBrouillon(etudiant.id, p.passageId, q3!.cle, "trop tard", 5)).rejects.toThrow(/écoulé/);
    const vue = await passages.getPassage(etudiant.id, p.passageId);
    expect(vue.termine).toBe(false); // pas de remise automatique pendant le délai photo
    const page2 = await passages.ajouterPhotosCopie(etudiant.id, p.passageId, [photo("2.b=PTS:3 calcul")]);
    expect(page2.nbPages).toBe(2);

    const rapport = await passages.rendreExamen(etudiant.id, p.passageId);
    // Question 1 : la réponse notée combine le texte tapé et la photo (le simulateur lit le 1er PTS).
    const tentatives = await prisma.tentativeEleve.findMany({ where: { passageId: p.passageId } });
    const t1 = tentatives.find((t) => t.questionEpreuveId === q1!.cle)!;
    expect(t1.reponseDonnee).toBe("PTS:1 début tapé\n\nPTS:2 suite sur papier");
    expect(rapport.parQuestion.map((x) => [x.numero, x.pointsObtenus])).toEqual([
      ["1", 1],
      ["2.a", 5],
      ["2.b", 3],
      ["3", 0],
    ]);
  });

  it("examen blanc sur papier : remise automatique seulement après le délai photo", async () => {
    const p = await passages.demarrerPassage(etudiant.id, partiel.id, "EXAMEN_BLANC");
    await passages.choisirCopiePapier(etudiant.id, p.passageId, true);
    await passages.ajouterPhotosCopie(etudiant.id, p.passageId, [photo("1=PTS:3")]);
    await prisma.passageEpreuve.update({ where: { id: p.passageId }, data: { dateLimiteAt: new Date(Date.now() - 11 * 60_000) } });
    await expect(passages.ajouterPhotosCopie(etudiant.id, p.passageId, [photo("2.a=PTS:8")])).rejects.toThrow(/délai/);
    const vue = await passages.getPassage(etudiant.id, p.passageId);
    expect(vue.termine).toBe(true);
    expect((await passages.getRapport(etudiant.id, p.passageId)).note).toBe(3);
  });
});
