import type { TentativeEleve, Notion, QuestionQcm } from "@prisma/client";
import {
  reformulateQuestion,
  generateSummarySheet,
  evaluateFreeAnswer,
  generateMetacognitiveQuestion,
  generateInitialDiagnostic,
  diagnosePrerequisite,
  explainQcmAnswer,
} from "@kalyaro/ai-service";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";
import { assertMatiereAccessible, getAccessibleMatiereIds } from "../../lib/matiere-access.js";
import { recordDailyActivity, projectCurrentStreak } from "../../lib/streak.js";
import { signQcmAttemptToken, verifyQcmAttemptToken, type QcmAttemptTokenPayload } from "./attempt-token.js";

const MASTERY_THRESHOLD = 3;
const FICHE_RESUME_FAILURE_THRESHOLD = 3;
const REVISION_INITIAL_INTERVAL_DAYS = 1;
const REVISION_MAX_INTERVAL_DAYS = 30;
const METACOGNITIVE_EVERY_N_ATTEMPTS = 3;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ---- Mes cours (navigation élève) ----

export const getMesCours = async (eleveId: string) => {
  const matiereIds = await getAccessibleMatiereIds(eleveId);
  if (matiereIds.length === 0) return [];

  return prisma.cours.findMany({
    where: { matiereId: { in: matiereIds } },
    include: { chapitres: { orderBy: { ordre: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
};

export const getStreak = async (eleveId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: eleveId },
    select: { streakCount: true, lastActivityAt: true },
  });
  return { streakCount: projectCurrentStreak(user.streakCount, user.lastActivityAt, new Date()) };
};

// ---- Épreuves (liste élève) ----

export const listEpreuvesForEleve = async (eleveId: string, matiereId: string) => {
  await assertMatiereAccessible(eleveId, matiereId);
  return prisma.epreuve.findMany({
    where: { matiereId, corriges: { some: { statutValidation: "VALIDE" } } },
    include: { notionPrincipale: true },
    orderBy: { createdAt: "desc" },
  });
};

// ---- Parcours (vue path map) ----

export const getParcoursChapitre = async (eleveId: string, chapitreId: string) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id: chapitreId }, include: { notions: true } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);

  const notionIds = chapitre.notions.map((n) => n.id);

  const edges = await prisma.prerequis.findMany({
    where: { notionId: { in: notionIds }, statut: "VALIDE_ADMIN" },
  });
  // Les prérequis peuvent référencer des notions hors du chapitre courant.
  const allRelevantIds = Array.from(new Set([...notionIds, ...edges.map((e) => e.prerequisNotionId)]));

  const progressions = await prisma.progressionNotion.findMany({
    where: { eleveId, notionId: { in: allRelevantIds } },
  });
  const progressionByNotion = new Map(progressions.map((p) => [p.notionId, p]));

  const prerequisByNotion = new Map<string, string[]>();
  for (const edge of edges) {
    if (!prerequisByNotion.has(edge.notionId)) prerequisByNotion.set(edge.notionId, []);
    prerequisByNotion.get(edge.notionId)!.push(edge.prerequisNotionId);
  }

  return chapitre.notions.map((notion) => {
    const progression = progressionByNotion.get(notion.id);
    const prerequisIds = prerequisByNotion.get(notion.id) ?? [];
    const verrouille = prerequisIds.some(
      (id) => (progressionByNotion.get(id)?.statut ?? "NON_VU") !== "MAITRISE"
    );
    return {
      notionId: notion.id,
      nom: notion.nom,
      statut: progression?.statut ?? "NON_VU",
      nbEchecsConsecutifs: progression?.nbEchecsConsecutifs ?? 0,
      nbSuccesConsecutifs: progression?.nbSuccesConsecutifs ?? 0,
      prochaineRevisionAt: progression?.prochaineRevisionAt ?? null,
      verrouille,
    };
  });
};

// ---- Boucle QCM ----

// Ni l'IA (génération/reformulation) ni la saisie admin ne garantissent que la bonne
// réponse change de position d'une question à l'autre — on le force ici, au seul
// endroit où une question QCM part vers l'élève, quelle que soit sa source.
function shuffleChoix(choix: string[]): string[] {
  const shuffled = [...choix];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

async function buildReformulatedQcmResponse(
  eleveId: string,
  notionId: string,
  notion: Notion,
  q: QuestionQcm
) {
  const reformulated = await reformulateQuestion({
    notionNom: notion.nom,
    enonceOriginal: q.enonce,
    choixOriginal: q.choix as string[],
    bonneReponseOriginal: q.bonneReponse,
  });
  const choix = shuffleChoix(reformulated.choix);
  const attemptToken = signQcmAttemptToken({
    eleveId,
    notionId,
    questionQcmId: q.id,
    bonneReponse: reformulated.bonneReponse,
    enonce: reformulated.enonce,
    choix,
  });
  return { enonce: reformulated.enonce, choix, attemptToken, reformulee: true };
}

export const getNextQcm = async (eleveId: string, notionId: string) => {
  const notion = await prisma.notion.findUnique({ where: { id: notionId } });
  if (!notion) throw new AppError("Notion introuvable", 404);

  const lastAttempt = await prisma.tentativeEleve.findFirst({
    where: { eleveId, typeCible: "QCM", questionQcm: { notions: { some: { notionId } } } },
    orderBy: { createdAt: "desc" },
    include: { questionQcm: true },
  });

  if (lastAttempt?.correcte === false && lastAttempt.questionQcm) {
    return buildReformulatedQcmResponse(eleveId, notionId, notion, lastAttempt.questionQcm);
  }

  const pool = await prisma.questionQcm.findMany({
    where: { statut: "PUBLIE", notions: { some: { notionId } } },
  });
  if (pool.length === 0) throw new AppError("Aucune question QCM publiée pour cette notion", 404);

  const excludeId = lastAttempt?.questionQcmId ?? null;
  const candidates = pool.filter((q) => q.id !== excludeId);

  if (candidates.length === 0 && lastAttempt?.questionQcm) {
    // Une seule question publiée pour cette notion : on reformule plutôt que de
    // renvoyer la question identique que l'élève vient de réussir.
    return buildReformulatedQcmResponse(eleveId, notionId, notion, lastAttempt.questionQcm);
  }

  const options = candidates.length > 0 ? candidates : pool;
  const chosen = options[Math.floor(Math.random() * options.length)]!;
  const choix = shuffleChoix(chosen.choix as string[]);

  const attemptToken = signQcmAttemptToken({
    eleveId,
    notionId,
    questionQcmId: chosen.id,
    bonneReponse: chosen.bonneReponse,
    enonce: chosen.enonce,
    choix,
  });
  return { enonce: chosen.enonce, choix, attemptToken, reformulee: false };
};

async function generateFicheResumeIfNeeded(notionId: string) {
  const existing = await prisma.ficheResume.findFirst({
    where: { notionId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const notion = await prisma.notion.findUniqueOrThrow({ where: { id: notionId } });
  const generated = await generateSummarySheet({
    notionNom: notion.nom,
    notionDescription: notion.description ?? "",
  });
  return prisma.ficheResume.create({
    data: {
      notionId,
      contenu: `# ${generated.titre}\n\n${generated.contenuMarkdown}`,
      statut: "A_VALIDER",
    },
  });
}

async function createMetacognitiveQuestion(tentative: TentativeEleve, payload: QcmAttemptTokenPayload) {
  const [notion, questionQcm] = await Promise.all([
    prisma.notion.findUniqueOrThrow({ where: { id: payload.notionId } }),
    prisma.questionQcm.findUniqueOrThrow({ where: { id: payload.questionQcmId } }),
  ]);
  const generated = await generateMetacognitiveQuestion({
    question: questionQcm.enonce,
    bonneReponse: payload.bonneReponse,
    notionNom: notion.nom,
  });
  const metacog = await prisma.questionMetacognitive.create({
    data: { questionQcmId: payload.questionQcmId, enonce: generated.enonce, source: "IA" },
  });
  return { id: metacog.id, enonce: metacog.enonce, tentativeId: tentative.id };
}

export const submitQcmAnswer = async (eleveId: string, attemptToken: string, reponseDonnee: string) => {
  const payload = verifyQcmAttemptToken(attemptToken);
  if (payload.eleveId !== eleveId) throw new AppError("Ce jeton n'appartient pas à cet élève", 403);

  const correcte = reponseDonnee === payload.bonneReponse;

  const previousAttemptsCount = await prisma.tentativeEleve.count({
    where: { eleveId, questionQcmId: payload.questionQcmId },
  });

  const tentative = await prisma.tentativeEleve.create({
    data: {
      eleveId,
      typeCible: "QCM",
      questionQcmId: payload.questionQcmId,
      reponseDonnee,
      correcte,
      tentativeNumero: previousAttemptsCount + 1,
    },
  });
  await recordDailyActivity(eleveId);

  const progression = await prisma.progressionNotion.upsert({
    where: { eleveId_notionId: { eleveId, notionId: payload.notionId } },
    create: { eleveId, notionId: payload.notionId, statut: "FRAGILE" },
    update: {},
  });

  let statut = progression.statut;
  let nbEchecs = progression.nbEchecsConsecutifs;
  let nbSucces = progression.nbSuccesConsecutifs;
  let intervalleRevisionJours = progression.intervalleRevisionJours;
  let derniereRevisionAt = progression.derniereRevisionAt;
  let prochaineRevisionAt = progression.prochaineRevisionAt;

  if (correcte) {
    nbEchecs = 0;
    if (statut === "MAITRISE") {
      // Révision réussie : on espace davantage la prochaine occurrence (plafonnée).
      intervalleRevisionJours = Math.min(intervalleRevisionJours * 2, REVISION_MAX_INTERVAL_DAYS);
      derniereRevisionAt = new Date();
      prochaineRevisionAt = addDays(new Date(), intervalleRevisionJours);
      nbSucces += 1;
    } else {
      nbSucces += 1;
      if (nbSucces >= MASTERY_THRESHOLD) {
        statut = "MAITRISE";
        intervalleRevisionJours = REVISION_INITIAL_INTERVAL_DAYS;
        derniereRevisionAt = new Date();
        prochaineRevisionAt = addDays(new Date(), intervalleRevisionJours);
      } else if (statut === "NON_VU") {
        statut = "FRAGILE";
      }
    }
  } else {
    nbSucces = 0;
    nbEchecs += 1;
    if (statut === "MAITRISE") {
      // Seul cas de régression : un échec de révision ramène la notion en fragile.
      statut = "FRAGILE";
      intervalleRevisionJours = REVISION_INITIAL_INTERVAL_DAYS;
      prochaineRevisionAt = null;
    } else if (statut === "NON_VU") {
      statut = "FRAGILE";
    }
  }

  await prisma.progressionNotion.update({
    where: { eleveId_notionId: { eleveId, notionId: payload.notionId } },
    data: {
      statut,
      nbEchecsConsecutifs: nbEchecs,
      nbSuccesConsecutifs: nbSucces,
      intervalleRevisionJours,
      derniereRevisionAt,
      prochaineRevisionAt,
    },
  });

  let ficheResume = null;
  if (!correcte && nbEchecs >= FICHE_RESUME_FAILURE_THRESHOLD) {
    ficheResume = await generateFicheResumeIfNeeded(payload.notionId);
  }

  let questionMetacognitive = null;
  if (tentative.tentativeNumero % METACOGNITIVE_EVERY_N_ATTEMPTS === 0) {
    questionMetacognitive = await createMetacognitiveQuestion(tentative, payload);
  }

  let indice: string | null = null;
  if (!correcte && nbEchecs === 1) {
    // On utilise l'énoncé/les choix embarqués dans le jeton (ce que l'élève a réellement
    // vu à l'écran), pas la question originale en base : si elle a été reformulée par
    // l'IA, les valeurs numériques diffèrent et un indice basé sur la version d'origine
    // induirait l'élève en erreur.
    const notion = await prisma.notion.findUniqueOrThrow({ where: { id: payload.notionId } });
    const explanation = await explainQcmAnswer({
      notionNom: notion.nom,
      question: payload.enonce,
      choix: payload.choix,
      reponseDonnee,
    });
    indice = explanation.indice;
  }

  return { correcte, statutNotion: statut, ficheResume, questionMetacognitive, indice };
};

// ---- Saisie libre (débloquée après maîtrise) ----

export const getNextSaisieLibre = async (eleveId: string, notionId: string) => {
  const progression = await prisma.progressionNotion.findUnique({
    where: { eleveId_notionId: { eleveId, notionId } },
  });
  if (!progression || progression.statut !== "MAITRISE") {
    throw new AppError("Cette notion n'est pas encore maîtrisée", 403);
  }
  const pool = await prisma.questionSaisieLibre.findMany({
    where: { statut: "PUBLIE", notions: { some: { notionId } } },
  });
  if (pool.length === 0) {
    throw new AppError("Aucune question à saisie libre publiée pour cette notion", 404);
  }
  const chosen = pool[Math.floor(Math.random() * pool.length)]!;
  return { id: chosen.id, enonce: chosen.enonce };
};

export const submitFreeAnswer = async (
  eleveId: string,
  questionSaisieLibreId: string,
  reponseDonnee: string
) => {
  const question = await prisma.questionSaisieLibre.findUnique({ where: { id: questionSaisieLibreId } });
  if (!question) throw new AppError("Question introuvable", 404);

  const evaluation = await evaluateFreeAnswer({
    question: question.enonce,
    reponseReference: question.reponseReference,
    reponseEleve: reponseDonnee,
  });

  const previousAttemptsCount = await prisma.tentativeEleve.count({
    where: { eleveId, questionSaisieLibreId },
  });
  await prisma.tentativeEleve.create({
    data: {
      eleveId,
      typeCible: "SAISIE_LIBRE",
      questionSaisieLibreId,
      reponseDonnee,
      correcte: evaluation.valide,
      evaluationIa: evaluation,
      tentativeNumero: previousAttemptsCount + 1,
    },
  });
  await recordDailyActivity(eleveId);

  return evaluation;
};

// ---- Révision espacée ----

export const getDueRevisions = async (eleveId: string) => {
  const due = await prisma.progressionNotion.findMany({
    where: { eleveId, statut: "MAITRISE", prochaineRevisionAt: { lte: new Date() } },
    include: { notion: true },
    orderBy: [{ nbEchecsConsecutifs: "desc" }, { prochaineRevisionAt: "asc" }],
  });
  return due.map((p) => ({
    notionId: p.notionId,
    nom: p.notion.nom,
    nbEchecsConsecutifs: p.nbEchecsConsecutifs,
    prochaineRevisionAt: p.prochaineRevisionAt,
  }));
};

// ---- Diagnostic initial de chapitre ----

async function findExternalPrerequisiteNotions(chapitreId: string) {
  const chapitreNotionIds = (
    await prisma.notion.findMany({ where: { chapitreId }, select: { id: true } })
  ).map((n) => n.id);
  const edges = await prisma.prerequis.findMany({
    where: { notionId: { in: chapitreNotionIds } },
    include: { prerequisNotion: true },
  });
  const external = new Map(
    edges
      .map((e) => e.prerequisNotion)
      .filter((n) => n.chapitreId !== chapitreId)
      .map((n) => [n.id, n])
  );
  return Array.from(external.values());
}

export const startDiagnosticInitial = async (eleveId: string, chapitreId: string) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id: chapitreId }, include: { notions: true } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  if (chapitre.notions.length === 0) {
    throw new AppError("Ce chapitre n'a pas encore de notions définies", 400);
  }

  const externes = await findExternalPrerequisiteNotions(chapitreId);

  const generated = await generateInitialDiagnostic({
    chapitreTitre: chapitre.titre,
    notionsChapitre: chapitre.notions.map((n) => ({ nom: n.nom, description: n.description ?? "" })),
    notionsPrerequisesExternes: externes.map((n) => ({ nom: n.nom, description: n.description ?? "" })),
  });

  const diagnostic = await prisma.diagnosticInitial.create({
    data: { eleveId, chapitreId, resultat: { questions: generated.questions, reponses: null } },
  });

  return { diagnosticId: diagnostic.id, questions: generated.questions };
};

export const submitDiagnosticInitial = async (
  diagnosticId: string,
  eleveId: string,
  reponses: { notionNom: string; reponseDonnee: string }[]
) => {
  const diagnostic = await prisma.diagnosticInitial.findUnique({ where: { id: diagnosticId } });
  if (!diagnostic || diagnostic.eleveId !== eleveId) throw new AppError("Diagnostic introuvable", 404);

  const stored = diagnostic.resultat as {
    questions: { enonce: string; choix: string[]; bonneReponse: string; notionNom: string }[];
  };
  const questions = stored.questions;

  let correctCount = 0;
  const details = reponses.map((r) => {
    const q = questions.find((qq) => qq.notionNom === r.notionNom);
    const correcte = q ? q.bonneReponse === r.reponseDonnee : false;
    if (correcte) correctCount++;
    return { notionNom: r.notionNom, correcte };
  });

  const ratio = questions.length > 0 ? correctCount / questions.length : 0;
  const niveauRecommande = ratio >= 0.75 ? "AVANCE" : ratio >= 0.4 ? "STANDARD" : "DEBUTANT";

  return prisma.diagnosticInitial.update({
    where: { id: diagnosticId },
    data: { resultat: { questions, reponses: details }, niveauRecommande },
  });
};

// ---- Réponse métacognitive ----

export const submitMetacognitiveAnswer = async (
  eleveId: string,
  data: { questionMetacognitiveId: string; tentativeId: string; reponseTexte: string }
) => {
  const question = await prisma.questionMetacognitive.findUnique({
    where: { id: data.questionMetacognitiveId },
  });
  if (!question) throw new AppError("Question métacognitive introuvable", 404);
  const tentative = await prisma.tentativeEleve.findUnique({ where: { id: data.tentativeId } });
  if (!tentative || tentative.eleveId !== eleveId) throw new AppError("Tentative introuvable", 404);

  return prisma.reponseMetacognitive.create({
    data: {
      eleveId,
      questionMetacognitiveId: data.questionMetacognitiveId,
      tentativeId: data.tentativeId,
      reponseTexte: data.reponseTexte,
    },
  });
};

// ---- Épreuves & diagnostic cognitif par remontée de graphe ----

type CheminParcouru = {
  path: { notionId: string; notionNom: string; resultat: "fail" | "success" }[];
  weakNotionId: string | null;
};

async function getDirectPrerequisites(notionId: string) {
  const edges = await prisma.prerequis.findMany({
    where: { notionId, statut: "VALIDE_ADMIN" },
    include: { prerequisNotion: true },
  });
  return edges.map((e) => e.prerequisNotion);
}

async function startPrerequisiteDescent(
  eleveId: string,
  epreuveId: string,
  notionDeclenchanteId: string,
  reponseEleve: string,
  contexteEchec: string
) {
  const notionDeclenchante = await prisma.notion.findUniqueOrThrow({ where: { id: notionDeclenchanteId } });
  const prereqs = await getDirectPrerequisites(notionDeclenchanteId);
  if (prereqs.length === 0) return null; // rien à sonder, pas de diagnostic possible

  const diagnosis = await diagnosePrerequisite({
    notionEnEchecNom: notionDeclenchante.nom,
    notionEnEchecDescription: notionDeclenchante.description ?? "",
    prerequisDirects: prereqs.map((p) => ({ nom: p.nom, description: p.description ?? "" })),
    reponseEleve,
    contexteEchec,
  });
  const candidate = prereqs.find((p) => p.nom === diagnosis.prerequisSuspecte)!;

  const chemin: CheminParcouru = {
    path: [{ notionId: notionDeclenchanteId, notionNom: notionDeclenchante.nom, resultat: "fail" }],
    weakNotionId: null,
  };

  const diagnostic = await prisma.diagnosticPrerequis.create({
    data: {
      eleveId,
      epreuveId,
      notionDeclenchanteId,
      notionPrerequisTesteeId: candidate.id,
      resolu: false,
      cheminParcouru: chemin,
    },
  });

  return {
    diagnosticId: diagnostic.id,
    notionASonder: { id: candidate.id, nom: candidate.nom, chapitreId: candidate.chapitreId },
  };
}

export const submitEpreuve = async (eleveId: string, epreuveId: string, reponseDonnee: string) => {
  const epreuve = await prisma.epreuve.findUnique({ where: { id: epreuveId } });
  if (!epreuve) throw new AppError("Épreuve introuvable", 404);

  const corriges = await prisma.corrigeType.findMany({
    where: { epreuveId, statutValidation: "VALIDE" },
    orderBy: { estPrincipal: "desc" },
  });
  if (corriges.length === 0) {
    throw new AppError("Aucun corrigé validé n'est disponible pour cette épreuve", 400);
  }

  // Plusieurs corrigés valides peuvent coexister (cas universitaire) — la réponse est
  // acceptée si elle correspond au sens de N'IMPORTE LEQUEL des corrigés validés.
  let valide = false;
  let explication = "";
  for (const corrige of corriges) {
    const evaluation = await evaluateFreeAnswer({
      question: epreuve.enonce,
      reponseReference: corrige.contenu,
      reponseEleve: reponseDonnee,
    });
    explication = evaluation.explication;
    if (evaluation.valide) {
      valide = true;
      break;
    }
  }

  const previousAttemptsCount = await prisma.tentativeEleve.count({ where: { eleveId, epreuveId } });
  await prisma.tentativeEleve.create({
    data: {
      eleveId,
      typeCible: "EPREUVE",
      epreuveId,
      reponseDonnee,
      correcte: valide,
      evaluationIa: { valide, explication },
      tentativeNumero: previousAttemptsCount + 1,
    },
  });
  await recordDailyActivity(eleveId);

  if (valide) {
    await prisma.diagnosticPrerequis.updateMany({
      where: { eleveId, epreuveId, resolu: false },
      data: { resolu: true },
    });
    return { valide, explication, diagnostic: null };
  }

  if (!epreuve.notionPrincipaleId) {
    return { valide: false, explication, diagnostic: null };
  }

  const diagnostic = await startPrerequisiteDescent(
    eleveId,
    epreuveId,
    epreuve.notionPrincipaleId,
    reponseDonnee,
    epreuve.enonce
  );
  return { valide: false, explication, diagnostic };
};

export const advanceDiagnostic = async (eleveId: string, diagnosticId: string, correcte: boolean) => {
  const diagnostic = await prisma.diagnosticPrerequis.findUnique({ where: { id: diagnosticId } });
  if (!diagnostic || diagnostic.eleveId !== eleveId) throw new AppError("Diagnostic introuvable", 404);
  if (diagnostic.resolu) throw new AppError("Ce diagnostic est déjà résolu", 400);

  const chemin = diagnostic.cheminParcouru as unknown as CheminParcouru;
  if (chemin.weakNotionId) {
    throw new AppError("Le niveau faible a déjà été identifié pour ce diagnostic", 400);
  }

  const testee = await prisma.notion.findUniqueOrThrow({ where: { id: diagnostic.notionPrerequisTesteeId } });
  const previousLevelId = chemin.path[chemin.path.length - 1]!.notionId;

  if (correcte) {
    // Le prérequis sondé est acquis -> le problème est au niveau juste au-dessus.
    const weakNotion = await prisma.notion.findUniqueOrThrow({ where: { id: previousLevelId } });
    chemin.path.push({ notionId: testee.id, notionNom: testee.nom, resultat: "success" });
    chemin.weakNotionId = weakNotion.id;
    await prisma.diagnosticPrerequis.update({
      where: { id: diagnosticId },
      data: { notionPrerequisTesteeId: weakNotion.id, cheminParcouru: chemin },
    });
    return {
      resolu: false,
      notionATravailler: { id: weakNotion.id, nom: weakNotion.nom, chapitreId: weakNotion.chapitreId },
      chemin: chemin.path,
    };
  }

  chemin.path.push({ notionId: testee.id, notionNom: testee.nom, resultat: "fail" });
  const prereqs = await getDirectPrerequisites(testee.id);

  if (prereqs.length === 0) {
    // Feuille du graphe, encore en échec : niveau faible par construction.
    chemin.weakNotionId = testee.id;
    await prisma.diagnosticPrerequis.update({ where: { id: diagnosticId }, data: { cheminParcouru: chemin } });
    return {
      resolu: false,
      notionATravailler: { id: testee.id, nom: testee.nom, chapitreId: testee.chapitreId },
      chemin: chemin.path,
    };
  }

  const diagnosis = await diagnosePrerequisite({
    notionEnEchecNom: testee.nom,
    notionEnEchecDescription: testee.description ?? "",
    prerequisDirects: prereqs.map((p) => ({ nom: p.nom, description: p.description ?? "" })),
    reponseEleve: "(échec du sondage ciblé sur cette notion)",
    contexteEchec: `Sondage ciblé sur la notion "${testee.nom}"`,
  });
  const candidate = prereqs.find((p) => p.nom === diagnosis.prerequisSuspecte)!;

  await prisma.diagnosticPrerequis.update({
    where: { id: diagnosticId },
    data: { notionPrerequisTesteeId: candidate.id, cheminParcouru: chemin },
  });

  return {
    resolu: false,
    notionASonder: { id: candidate.id, nom: candidate.nom, chapitreId: candidate.chapitreId },
    chemin: chemin.path,
  };
};
