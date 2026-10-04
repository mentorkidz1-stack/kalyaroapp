import type { Epreuve, Notion, QuestionEpreuve, TypeParcours } from "@prisma/client";
import { gradeExamAnswer } from "@kalyaro/ai-service";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";
import { assertMatiereAccessible } from "../../lib/matiere-access.js";
import { recordDailyActivity } from "../../lib/streak.js";
import { startPrerequisiteDescent } from "../progression/progression.service.js";
import { arrondirPoints, calculerRapport, estRatee, type QuestionBareme } from "./notation.js";

/** Clé de la question unique d'une épreuve non découpée (compatibilité ascendante). */
export const CLE_QUESTION_UNIQUE = "unique";
/** Barème par défaut d'une épreuve non découpée sans barème renseigné. */
const BAREME_PAR_DEFAUT = 20;

interface QuestionNotable {
  cle: string;
  questionEpreuveId: string | null;
  numero: string;
  enonce: string;
  points: number;
  notionId: string | null;
  notionNom: string | null;
  imageUrls: string[];
  corrigesValides: string[];
}

type EpreuveComplete = Epreuve & {
  notionPrincipale: Notion | null;
  corriges: { contenu: string; statutValidation: string; estPrincipal: boolean }[];
  questions: (QuestionEpreuve & {
    notion: Notion | null;
    corriges: { contenu: string; statutValidation: string; estPrincipal: boolean }[];
  })[];
  matiere: { type: TypeParcours };
};

const includeEpreuveComplete = {
  notionPrincipale: true,
  corriges: true,
  matiere: { select: { type: true } },
  questions: { include: { notion: true, corriges: true }, orderBy: { ordre: "asc" as const } },
};

const corrigesValides = (corriges: { contenu: string; statutValidation: string; estPrincipal: boolean }[]) =>
  corriges
    .filter((c) => c.statutValidation === "VALIDE")
    .sort((a, b) => Number(b.estPrincipal) - Number(a.estPrincipal))
    .map((c) => c.contenu);

/**
 * Questions notables d'une épreuve : ses questions découpées, ou — épreuve non découpée —
 * une question unique virtuelle (énoncé complet, notion principale, corrigés de l'épreuve).
 */
function questionsNotables(epreuve: EpreuveComplete): QuestionNotable[] {
  if (epreuve.questions.length > 0) {
    return epreuve.questions.map((q) => ({
      cle: q.id,
      questionEpreuveId: q.id,
      numero: q.numero,
      enonce: q.enonce,
      points: q.points,
      notionId: q.notionId,
      notionNom: q.notion?.nom ?? null,
      imageUrls: q.imageUrls,
      corrigesValides: corrigesValides(q.corriges),
    }));
  }
  return [
    {
      cle: CLE_QUESTION_UNIQUE,
      questionEpreuveId: null,
      numero: "1",
      enonce: epreuve.enonce,
      points: epreuve.bareme ?? BAREME_PAR_DEFAUT,
      notionId: epreuve.notionPrincipaleId,
      notionNom: epreuve.notionPrincipale?.nom ?? null,
      imageUrls: [],
      corrigesValides: corrigesValides(epreuve.corriges),
    },
  ];
}

/** Une épreuve n'est proposée que si chaque question a au moins un corrigé validé. */
const estNotable = (questions: QuestionNotable[]) => questions.every((q) => q.corrigesValides.length > 0);

const bareme = (epreuve: Epreuve, questions: QuestionNotable[]) =>
  epreuve.bareme ?? questions.reduce((s, q) => s + q.points, 0);

const metadonnees = (e: Epreuve) => ({
  annee: e.annee,
  session: e.session,
  examen: e.examen,
  etablissementSource: e.etablissementSource,
  dureeMinutes: e.dureeMinutes,
});

async function chargerEpreuve(epreuveId: string): Promise<EpreuveComplete> {
  const epreuve = await prisma.epreuve.findUnique({ where: { id: epreuveId }, include: includeEpreuveComplete });
  if (!epreuve) throw new AppError("Épreuve introuvable", 404);
  return epreuve;
}

// ---- Liste des épreuves d'une matière ----

export const listEpreuvesPourEtudiant = async (eleveId: string, matiereId: string) => {
  await assertMatiereAccessible(eleveId, matiereId);
  const epreuves = await prisma.epreuve.findMany({
    where: { matiereId },
    include: {
      ...includeEpreuveComplete,
      passages: {
        where: { eleveId, termineAt: { not: null } },
        orderBy: { termineAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ annee: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });

  return epreuves.flatMap((e) => {
    const questions = questionsNotables(e);
    if (!estNotable(questions)) return [];
    const dernier = e.passages[0];
    return [
      {
        id: e.id,
        enonce: e.enonce,
        ...metadonnees(e),
        bareme: bareme(e, questions),
        nbQuestions: questions.length,
        decoupee: e.questions.length > 0,
        dernierPassage: dernier
          ? { id: dernier.id, termineAt: dernier.termineAt, note: dernier.pointsObtenus, bareme: dernier.bareme }
          : null,
      },
    ];
  });
};

// ---- Passage ----

async function chargerPassage(eleveId: string, passageId: string) {
  const passage = await prisma.passageEpreuve.findUnique({
    where: { id: passageId },
    include: { tentatives: { orderBy: { createdAt: "asc" } } },
  });
  if (!passage || passage.eleveId !== eleveId) throw new AppError("Passage introuvable", 404);
  const epreuve = await chargerEpreuve(passage.epreuveId);
  return { passage, epreuve, questions: questionsNotables(epreuve) };
}

const cleDeTentative = (t: { questionEpreuveId: string | null }) => t.questionEpreuveId ?? CLE_QUESTION_UNIQUE;

type EvaluationIaEpreuve = { explication: string; elementsReussis: string[]; elementsManquants: string[] };

function vuePassage({ passage, epreuve, questions }: Awaited<ReturnType<typeof chargerPassage>>) {
  const reponses = Object.fromEntries(
    passage.tentatives.map((t) => {
      const ia = (t.evaluationIa ?? {}) as Partial<EvaluationIaEpreuve>;
      return [
        cleDeTentative(t),
        {
          reponseDonnee: t.reponseDonnee,
          pointsObtenus: t.pointsObtenus ?? 0,
          pointsMax: t.pointsMax ?? 0,
          explication: ia.explication ?? "",
          elementsReussis: ia.elementsReussis ?? [],
          elementsManquants: ia.elementsManquants ?? [],
        },
      ];
    })
  );
  return {
    passageId: passage.id,
    mode: passage.mode,
    termine: passage.termineAt !== null,
    epreuve: {
      id: epreuve.id,
      // Sujet complet : données communes à toutes les questions d'une épreuve découpée.
      enonce: epreuve.enonce,
      decoupee: epreuve.questions.length > 0,
      ...metadonnees(epreuve),
      bareme: bareme(epreuve, questions),
    },
    // Jamais les corrigés : ils restent côté serveur.
    questions: questions.map((q) => ({
      cle: q.cle,
      numero: q.numero,
      enonce: q.enonce,
      points: q.points,
      notionNom: q.notionNom,
      imageUrls: q.imageUrls,
    })),
    reponses,
  };
}

export const demarrerPassage = async (eleveId: string, epreuveId: string) => {
  const epreuve = await chargerEpreuve(epreuveId);
  await assertMatiereAccessible(eleveId, epreuve.matiereId);
  if (!estNotable(questionsNotables(epreuve))) {
    throw new AppError("Cette épreuve n'a pas encore de corrigé validé pour chaque question", 400);
  }
  const passage = await prisma.passageEpreuve.create({ data: { eleveId, epreuveId, mode: "ENTRAINEMENT" } });
  return vuePassage(await chargerPassage(eleveId, passage.id));
};

export const getPassage = async (eleveId: string, passageId: string) =>
  vuePassage(await chargerPassage(eleveId, passageId));

/**
 * Corrige une réponse contre les corrigés validés de la question (points partiels), puis,
 * si la question est ratée, lance la descente diagnostique sur SA notion.
 */
export const repondreQuestion = async (eleveId: string, passageId: string, cle: string, reponseDonnee: string) => {
  const { passage, epreuve, questions } = await chargerPassage(eleveId, passageId);
  if (passage.termineAt) throw new AppError("Ce passage est terminé", 400);
  const question = questions.find((q) => q.cle === cle);
  if (!question) throw new AppError("Question introuvable dans cette épreuve", 404);
  if (passage.tentatives.some((t) => cleDeTentative(t) === cle)) {
    throw new AppError("Tu as déjà répondu à cette question dans ce passage", 409);
  }

  // L'appel IA a lieu AVANT toute écriture : s'il échoue, rien n'est enregistré et
  // l'étudiant peut simplement renvoyer sa réponse.
  const evaluation = await gradeExamAnswer({
    parcours: epreuve.matiere.type,
    contexteEpreuve: epreuve.questions.length > 0 ? epreuve.enonce : undefined,
    numero: question.numero,
    enonceQuestion: question.enonce,
    pointsMax: question.points,
    corriges: question.corrigesValides,
    reponseEtudiant: reponseDonnee,
  });
  const pointsObtenus = arrondirPoints(evaluation.pointsObtenus, question.points);
  const ratee = estRatee(pointsObtenus, question.points);
  const evaluationIa: EvaluationIaEpreuve = {
    explication: evaluation.explication,
    elementsReussis: evaluation.elementsReussis,
    elementsManquants: evaluation.elementsManquants,
  };

  const precedentes = await prisma.tentativeEleve.count({
    where: { eleveId, epreuveId: epreuve.id, questionEpreuveId: question.questionEpreuveId },
  });
  await prisma.tentativeEleve.create({
    data: {
      eleveId,
      typeCible: "EPREUVE",
      epreuveId: epreuve.id,
      questionEpreuveId: question.questionEpreuveId,
      passageId,
      reponseDonnee,
      correcte: !ratee,
      pointsObtenus,
      pointsMax: question.points,
      evaluationIa,
      tentativeNumero: precedentes + 1,
    },
  });
  await recordDailyActivity(eleveId);

  let diagnostic = null;
  if (question.notionId) {
    if (ratee) {
      // Enrichissement : un échec du diagnostic (IA indisponible…) ne doit pas faire perdre
      // la note, déjà enregistrée.
      try {
        diagnostic = await startPrerequisiteDescent(
          eleveId,
          epreuve.id,
          question.notionId,
          reponseDonnee,
          `Question ${question.numero} : ${question.enonce}`
        );
      } catch {
        diagnostic = null;
      }
    } else {
      await prisma.diagnosticPrerequis.updateMany({
        where: { eleveId, epreuveId: epreuve.id, notionDeclenchanteId: question.notionId, resolu: false },
        data: { resolu: true },
      });
    }
  }

  return { cle, pointsObtenus, pointsMax: question.points, ratee, ...evaluationIa, diagnostic };
};

function rapportDuPassage({ passage, epreuve, questions }: Awaited<ReturnType<typeof chargerPassage>>) {
  const bareme_: QuestionBareme[] = questions.map((q) => ({
    cle: q.cle,
    numero: q.numero,
    points: q.points,
    notionId: q.notionId,
    notionNom: q.notionNom,
  }));
  const reponses = passage.tentatives.map((t) => ({ cle: cleDeTentative(t), pointsObtenus: t.pointsObtenus ?? 0 }));
  return calculerRapport(bareme_, reponses, epreuve.bareme);
}

export const terminerPassage = async (eleveId: string, passageId: string) => {
  const charge = await chargerPassage(eleveId, passageId);
  const rapport = rapportDuPassage(charge);
  if (!charge.passage.termineAt) {
    await prisma.passageEpreuve.update({
      where: { id: passageId },
      data: { termineAt: new Date(), pointsObtenus: rapport.note, bareme: rapport.bareme },
    });
  }
  return rapport;
};

export const getRapport = async (eleveId: string, passageId: string) => {
  const charge = await chargerPassage(eleveId, passageId);
  return { termine: charge.passage.termineAt !== null, ...rapportDuPassage(charge) };
};
