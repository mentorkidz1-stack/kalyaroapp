import { Prisma, type TentativeEleve } from "@prisma/client";
import {
  generateSummarySheet,
  evaluateFreeAnswer,
  generateMetacognitiveQuestion,
  generateInitialDiagnostic,
  diagnosePrerequisite,
  explainQcmAnswer,
} from "@kalyaro/ai-service";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";
import { getAccessibleMatiereIds } from "../../lib/matiere-access.js";
import { corrigerReponseFigure, libelleReponseDonnee, reponseAttendueSchema } from "@kalyaro/shared";
import { recordDailyActivity, projectCurrentStreak } from "../../lib/streak.js";
import { signQcmAttemptToken, verifyQcmAttemptToken, type QcmAttemptTokenPayload } from "./attempt-token.js";
import { estimerDureeMinutes, planifierSeance, prochaineRevisionDans, trierNotionsDues } from "./revisions.js";
import { computeNextProgression, estAcquise } from "./mastery.js";
import { choisirQuestionSuivante, racineDe } from "./selection-qcm.js";

const FICHE_RESUME_FAILURE_THRESHOLD = 3;
const METACOGNITIVE_EVERY_N_ATTEMPTS = 3;
/** Fenêtre utilisée pour compter les erreurs « récentes » lors du tri des révisions. */
const ECHECS_RECENTS_JOURS = 30;

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
    const verrouille = prerequisIds.some((id) => !estAcquise(progressionByNotion.get(id)?.statut));
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

// Ni l'IA (génération) ni la saisie admin ne garantissent que la bonne réponse change de
// position d'une question à l'autre — on le force ici, au seul endroit où une question
// QCM part vers l'étudiant, quelle que soit sa source.
function shuffleChoix(choix: string[]): string[] {
  const shuffled = [...choix];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

/**
 * Prochaine question QCM d'une notion. Uniquement du contenu publié : après un échec, une
 * variante validée de la question ratée (chantier 1.3) — plus jamais de reformulation IA
 * générée en direct, dont le corrigé n'aurait été relu par personne.
 */
export const getNextQcm = async (eleveId: string, notionId: string) => {
  const notion = await prisma.notion.findUnique({ where: { id: notionId } });
  if (!notion) throw new AppError("Notion introuvable", 404);

  const [lastAttempt, pool] = await Promise.all([
    prisma.tentativeEleve.findFirst({
      where: { eleveId, typeCible: "QCM", questionQcm: { notions: { some: { notionId } } } },
      orderBy: { createdAt: "desc" },
      include: { questionQcm: { select: { id: true, varianteDeId: true } } },
    }),
    prisma.questionQcm.findMany({
      where: { statut: "PUBLIE", notions: { some: { notionId } } },
    }),
  ]);

  const selection = choisirQuestionSuivante(
    pool,
    lastAttempt?.questionQcm
      ? {
          questionQcmId: lastAttempt.questionQcm.id,
          correcte: lastAttempt.correcte,
          questionRacineId: racineDe(lastAttempt.questionQcm),
        }
      : null
  );
  // Absence de contenu, pas une erreur : le frontend affiche un état "aucune question
  // disponible" dédié plutôt qu'un écran d'erreur avec un bouton Réessayer inutile.
  if (!selection) return null;

  const chosen = selection.question;
  const surFigure = chosen.typeReponse !== "CHOIX";
  const choix = surFigure ? [] : shuffleChoix(chosen.choix as string[]);
  const attendue = surFigure ? reponseAttendueSchema.safeParse(chosen.reponseAttendue) : null;
  const attemptToken = signQcmAttemptToken({
    eleveId,
    notionId,
    questionQcmId: chosen.id,
    bonneReponse: chosen.bonneReponse,
    enonce: chosen.enonce,
    choix,
    // La réponse attendue voyage chiffrée dans le jeton, jamais en clair vers l'étudiant.
    ...(surFigure ? { typeReponse: chosen.typeReponse, reponseAttendue: chosen.reponseAttendue } : {}),
  });
  return {
    enonce: chosen.enonce,
    choix,
    attemptToken,
    estVariante: selection.motif === "variante",
    figure: chosen.figure ?? null,
    typeReponse: chosen.typeReponse,
    // Aides à la saisie seulement (aimant de grille, unité) — pas la position attendue.
    interaction:
      attendue?.success && attendue.data.type === "PLACER_POINT"
        ? { pasGrille: attendue.data.pasGrille ?? null }
        : attendue?.success && attendue.data.type === "LIRE_VALEUR"
          ? { unite: attendue.data.unite ?? null }
          : null,
  };
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

  // Anti-rejeu : un attemptToken valide capturé (devtools) ne doit pouvoir compter qu'une
  // seule fois, sinon rejouer un token après une bonne réponse permettrait d'incrémenter
  // artificiellement nbSuccesConsecutifs jusqu'à ACQUIS_DU_JOUR sans répondre à de vraies
  // questions distinctes. L'insertion échoue sur la contrainte de clé primaire (jti) si
  // le jeton a déjà été consommé — atomique, pas de fenêtre de course possible.
  try {
    await prisma.consumedAttemptToken.create({
      data: { jti: payload.jti, expiresAt: new Date(payload.exp) },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError("Cette question a déjà été répondue.", 409);
    }
    throw err;
  }

  const attendueFigure =
    payload.typeReponse && payload.typeReponse !== "CHOIX" ? reponseAttendueSchema.safeParse(payload.reponseAttendue) : null;
  const correcte = attendueFigure
    ? attendueFigure.success && corrigerReponseFigure(attendueFigure.data, reponseDonnee)
    : reponseDonnee === payload.bonneReponse;

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
    create: { eleveId, notionId: payload.notionId, statut: "NON_VU" },
    update: {},
  });

  const statutPrecedent = progression.statut;
  const suivant = computeNextProgression(progression, { correcte, now: new Date() });
  const statut = suivant.statut;
  const nbEchecs = suivant.nbEchecsConsecutifs;

  await prisma.progressionNotion.update({
    where: { eleveId_notionId: { eleveId, notionId: payload.notionId } },
    data: {
      statut,
      nbEchecsConsecutifs: suivant.nbEchecsConsecutifs,
      nbSuccesConsecutifs: suivant.nbSuccesConsecutifs,
      intervalleRevisionJours: suivant.intervalleRevisionJours,
      derniereRevisionAt: suivant.derniereRevisionAt,
      prochaineRevisionAt: suivant.prochaineRevisionAt,
      derniereTentativeAt: suivant.derniereTentativeAt,
    },
  });

  // La tentative et la progression sont déjà persistées à ce stade. Les trois appels IA
  // ci-dessous sont des enrichissements de la réponse (fiche résumé, question méta,
  // indice) : si l'un d'eux échoue (quota IA, réseau...), on ne doit ni faire échouer
  // toute la requête ni la faire remonter en erreur côté élève — celui-ci recliquerait
  // sur le même choix et créerait une deuxième tentative fantôme pour la même réponse.
  let ficheResume = null;
  if (!correcte && nbEchecs >= FICHE_RESUME_FAILURE_THRESHOLD) {
    try {
      ficheResume = await generateFicheResumeIfNeeded(payload.notionId);
    } catch {
      ficheResume = null;
    }
  }

  let questionMetacognitive = null;
  if (tentative.tentativeNumero % METACOGNITIVE_EVERY_N_ATTEMPTS === 0) {
    try {
      questionMetacognitive = await createMetacognitiveQuestion(tentative, payload);
    } catch {
      questionMetacognitive = null;
    }
  }

  // L'indice est généré en arrière-plan, pas attendu ici : explainQcmAnswer prend
  // couramment plusieurs secondes, et le faire attendre à l'élève avant même de savoir
  // s'il a juste ou faux rend chaque mauvaise réponse perceptiblement lente. La réponse
  // part immédiatement avec indice=null ; le frontend récupère l'indice via un court
  // sondage sur GET .../qcm/tentatives/:id/indice une fois qu'il est prêt.
  if (!correcte) {
    generateIndiceInBackground(tentative.id, payload, reponseDonnee);
  }

  return {
    tentativeId: tentative.id,
    correcte,
    statutNotion: statut,
    statutPrecedent,
    ficheResume,
    questionMetacognitive,
    indice: null,
  };
};

function generateIndiceInBackground(
  tentativeId: string,
  payload: QcmAttemptTokenPayload,
  reponseDonnee: string
) {
  (async () => {
    // On utilise l'énoncé/les choix embarqués dans le jeton : c'est exactement ce que
    // l'étudiant a vu à l'écran, choix remélangés compris.
    const notion = await prisma.notion.findUniqueOrThrow({ where: { id: payload.notionId } });
    const surFigure = payload.typeReponse && payload.typeReponse !== "CHOIX" ? payload.typeReponse : null;
    const question = surFigure
      ? await prisma.questionQcm.findUnique({ where: { id: payload.questionQcmId }, select: { figure: true } })
      : null;
    const explanation = await explainQcmAnswer({
      notionNom: notion.nom,
      question: payload.enonce,
      choix: payload.choix,
      reponseDonnee: surFigure ? libelleReponseDonnee(surFigure, reponseDonnee) : reponseDonnee,
      ...(surFigure ? { surFigure: { consigne: surFigure, figure: question?.figure ?? null } } : {}),
    });
    await prisma.tentativeEleve.update({
      where: { id: tentativeId },
      data: { indice: explanation.indice },
    });
  })().catch(() => {
    // Échec silencieux : le champ indice reste null, le sondage frontend abandonnera
    // après son délai maximal plutôt que de bloquer indéfiniment.
  });
}

export const getTentativeIndice = async (eleveId: string, tentativeId: string) => {
  const tentative = await prisma.tentativeEleve.findUnique({
    where: { id: tentativeId },
    select: { eleveId: true, indice: true },
  });
  if (!tentative || tentative.eleveId !== eleveId) throw new AppError("Tentative introuvable", 404);
  return { indice: tentative.indice };
};

// ---- Saisie libre (débloquée dès que la notion est acquise) ----

export const getNextSaisieLibre = async (eleveId: string, notionId: string) => {
  const progression = await prisma.progressionNotion.findUnique({
    where: { eleveId_notionId: { eleveId, notionId } },
  });
  if (!estAcquise(progression?.statut)) {
    throw new AppError("Cette notion n'est pas encore acquise", 403);
  }
  const pool = await prisma.questionSaisieLibre.findMany({
    where: { statut: "PUBLIE", notions: { some: { notionId } } },
  });
  if (pool.length === 0) {
    throw new AppError("Aucune question à saisie libre publiée pour cette notion", 404);
  }
  const chosen = pool[Math.floor(Math.random() * pool.length)]!;
  return { id: chosen.id, enonce: chosen.enonce, figure: chosen.figure ?? null };
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

export const getDueRevisions = async (eleveId: string, now = new Date()) => {
  const matiereIds = await getAccessibleMatiereIds(eleveId);
  const progressions = await prisma.progressionNotion.findMany({
    where: {
      eleveId,
      statut: { not: "NON_VU" },
      prochaineRevisionAt: { lte: now },
      // Une notion sans question publiée ne peut pas être révisée : elle bloquerait la séance.
      notion: {
        chapitre: { cours: { matiereId: { in: matiereIds } } },
        questionsQcm: { some: { questionQcm: { statut: "PUBLIE" } } },
      },
    },
    include: { notion: { select: { nom: true, chapitreId: true } } },
  });

  const notionIds = new Set(progressions.map((p) => p.notionId));
  const echecs =
    notionIds.size === 0
      ? []
      : await prisma.tentativeEleve.findMany({
          where: {
            eleveId,
            typeCible: "QCM",
            correcte: false,
            createdAt: { gte: prochaineRevisionDans(now, -ECHECS_RECENTS_JOURS) },
            questionQcm: { notions: { some: { notionId: { in: [...notionIds] } } } },
          },
          select: { createdAt: true, questionQcm: { select: { notions: { select: { notionId: true } } } } },
        });

  const echecsParNotion = new Map<string, { dernier: Date; nb: number }>();
  for (const echec of echecs) {
    for (const { notionId } of echec.questionQcm?.notions ?? []) {
      if (!notionIds.has(notionId)) continue;
      const courant = echecsParNotion.get(notionId);
      echecsParNotion.set(notionId, {
        dernier: courant && courant.dernier > echec.createdAt ? courant.dernier : echec.createdAt,
        nb: (courant?.nb ?? 0) + 1,
      });
    }
  }

  const notions = trierNotionsDues(
    progressions.map((p) => ({
      notionId: p.notionId,
      nom: p.notion.nom,
      chapitreId: p.notion.chapitreId,
      statut: p.statut,
      nbEchecsConsecutifs: p.nbEchecsConsecutifs,
      dernierEchecAt: echecsParNotion.get(p.notionId)?.dernier ?? null,
      nbEchecsRecents: echecsParNotion.get(p.notionId)?.nb ?? 0,
      prochaineRevisionAt: p.prochaineRevisionAt!,
    }))
  );
  const seance = planifierSeance(notions);

  return {
    nbNotionsDues: notions.length,
    nbQuestions: seance.length,
    dureeEstimeeMinutes: estimerDureeMinutes(seance.length),
    notions: notions.map((n) => ({
      notionId: n.notionId,
      nom: n.nom,
      chapitreId: n.chapitreId,
      statut: n.statut,
      nbEchecsConsecutifs: n.nbEchecsConsecutifs,
      prochaineRevisionAt: n.prochaineRevisionAt,
    })),
    /** Une entrée par question de la séance : l'id de la notion à interroger, dans l'ordre. */
    seance,
  };
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

/** Démarre la descente dans le graphe de prérequis à partir de la notion d'une question ratée.
 * Renvoie null si la notion n'a pas de prérequis validé à sonder. */
export async function startPrerequisiteDescent(
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

export const advanceDiagnostic = async (eleveId: string, diagnosticId: string, tentativeId: string) => {
  const diagnostic = await prisma.diagnosticPrerequis.findUnique({ where: { id: diagnosticId } });
  if (!diagnostic || diagnostic.eleveId !== eleveId) throw new AppError("Diagnostic introuvable", 404);
  if (diagnostic.resolu) throw new AppError("Ce diagnostic est déjà résolu", 400);

  const chemin = diagnostic.cheminParcouru as unknown as CheminParcouru;
  if (chemin.weakNotionId) {
    throw new AppError("Le niveau faible a déjà été identifié pour ce diagnostic", 400);
  }

  // Le verdict vient exclusivement de la tentative QCM vérifiée serveur (submitQcmAnswer),
  // jamais d'un booléen envoyé par le client : sinon n'importe quel appel avec
  // {"correcte": true} piloterait la descente du graphe sans avoir répondu à rien.
  const tentative = await prisma.tentativeEleve.findUnique({
    where: { id: tentativeId },
    include: { questionQcm: { include: { notions: true } } },
  });
  if (!tentative || tentative.eleveId !== eleveId) {
    throw new AppError("Tentative introuvable", 404);
  }
  if (tentative.typeCible !== "QCM" || !tentative.questionQcm) {
    throw new AppError("Cette tentative ne correspond pas à une question QCM", 400);
  }
  const testeeMatches = tentative.questionQcm.notions.some(
    (link) => link.notionId === diagnostic.notionPrerequisTesteeId
  );
  if (!testeeMatches) {
    throw new AppError("Cette tentative ne correspond pas au prérequis actuellement sondé", 400);
  }

  // Réclamation atomique : si `usedForDiagnosticAt` n'est plus null, la tentative a déjà
  // servi à faire avancer un diagnostic (celui-ci ou un autre) et ne peut pas être réutilisée.
  const claim = await prisma.tentativeEleve.updateMany({
    where: { id: tentativeId, usedForDiagnosticAt: null },
    data: { usedForDiagnosticAt: new Date() },
  });
  if (claim.count === 0) {
    throw new AppError("Cette tentative a déjà été utilisée pour faire avancer un diagnostic", 409);
  }

  const correcte = tentative.correcte === true;

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
