import type { SourceCorrige, StatutValidation } from "@prisma/client";
import { generateAnswerKey, proposeExamSplit } from "@kalyaro/ai-service";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";
import { extractPdfText } from "../../lib/pdf-upload.js";

async function extractPdfTextOrThrow(buffer: Buffer): Promise<string> {
  let text: string;
  try {
    text = await extractPdfText(buffer);
  } catch {
    throw new AppError("Impossible d'extraire le texte de ce PDF", 400);
  }
  if (!text) throw new AppError("Le PDF ne contient aucun texte extractible", 400);
  return text;
}

// ---- Épreuves ----

export const listEpreuvesByMatiere = (matiereId: string) =>
  prisma.epreuve.findMany({
    where: { matiereId },
    include: { corriges: true, notionPrincipale: true, _count: { select: { questions: true } } },
    orderBy: { createdAt: "desc" },
  });

export interface MetadonneesEpreuve {
  annee?: number | null;
  session?: string | null;
  examen?: string | null;
  etablissementSource?: string | null;
  dureeMinutes?: number | null;
  bareme?: number | null;
}

export const createEpreuve = async (
  matiereId: string,
  createdById: string,
  data: {
    chapitreId?: string;
    notionPrincipaleId?: string;
    enonce: string;
    sourceCorrige: SourceCorrige;
  } & MetadonneesEpreuve
) => {
  const matiere = await prisma.matiere.findUnique({ where: { id: matiereId } });
  if (!matiere) throw new AppError("Matière introuvable", 404);
  if (data.chapitreId) {
    const chapitre = await prisma.chapitre.findUnique({ where: { id: data.chapitreId } });
    if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  }
  if (data.notionPrincipaleId) {
    const notion = await prisma.notion.findUnique({ where: { id: data.notionPrincipaleId } });
    if (!notion) throw new AppError("Notion introuvable", 404);
  }
  return prisma.epreuve.create({ data: { matiereId, createdById, ...data } });
};

export const createEpreuveFromPdf = async (
  matiereId: string,
  createdById: string,
  data: { chapitreId?: string; notionPrincipaleId?: string; sourceCorrige: SourceCorrige } & MetadonneesEpreuve,
  pdfBuffer: Buffer
) => {
  const enonce = await extractPdfTextOrThrow(pdfBuffer);
  return createEpreuve(matiereId, createdById, { ...data, enonce });
};

export const updateEpreuve = async (
  id: string,
  data: {
    chapitreId?: string | null;
    notionPrincipaleId?: string | null;
    enonce?: string;
    sourceCorrige?: SourceCorrige;
  } & MetadonneesEpreuve
) => {
  const existing = await prisma.epreuve.findUnique({ where: { id } });
  if (!existing) throw new AppError("Épreuve introuvable", 404);
  return prisma.epreuve.update({ where: { id }, data });
};

export const deleteEpreuve = async (id: string) => {
  const existing = await prisma.epreuve.findUnique({ where: { id } });
  if (!existing) throw new AppError("Épreuve introuvable", 404);
  await prisma.epreuve.delete({ where: { id } });
};

// ---- Corrigés-types ----

export const listCorrigesByEpreuve = (epreuveId: string) =>
  prisma.corrigeType.findMany({ where: { epreuveId }, orderBy: { createdAt: "desc" } });

/** Tous les corrigés en attente de validation, toutes épreuves confondues — file de validation. */
export const listCorrigesAValider = () =>
  prisma.corrigeType.findMany({
    where: { statutValidation: "A_VALIDER" },
    include: { epreuve: true },
    orderBy: { createdAt: "desc" },
  });

export const createCorrige = async (
  epreuveId: string,
  createdById: string,
  data: { contenu: string; estPrincipal: boolean }
) => {
  const epreuve = await prisma.epreuve.findUnique({ where: { id: epreuveId } });
  if (!epreuve) throw new AppError("Épreuve introuvable", 404);
  // Fourni directement par un admin -> déjà validé (même logique que le reste du contenu manuel).
  return prisma.corrigeType.create({
    data: {
      epreuveId,
      createdById,
      contenu: data.contenu,
      estPrincipal: data.estPrincipal,
      statutValidation: "VALIDE",
    },
  });
};

export const createCorrigeFromPdf = async (
  epreuveId: string,
  createdById: string,
  estPrincipal: boolean,
  pdfBuffer: Buffer
) => {
  const contenu = await extractPdfTextOrThrow(pdfBuffer);
  return createCorrige(epreuveId, createdById, { contenu, estPrincipal });
};

export const updateCorrige = async (
  id: string,
  data: { contenu?: string; estPrincipal?: boolean; statutValidation?: StatutValidation }
) => {
  const existing = await prisma.corrigeType.findUnique({ where: { id } });
  if (!existing) throw new AppError("Corrigé introuvable", 404);
  return prisma.corrigeType.update({ where: { id }, data });
};

export const generateCorrigeIa = async (epreuveId: string, createdById: string) => {
  const epreuve = await prisma.epreuve.findUnique({
    where: { id: epreuveId },
    include: { chapitre: { include: { cours: true } } },
  });
  if (!epreuve) throw new AppError("Épreuve introuvable", 404);

  const result = await generateAnswerKey({
    enonceEpreuve: epreuve.enonce,
    contexteCours: epreuve.chapitre?.contenuExtrait ?? epreuve.chapitre?.cours.contenuExtrait ?? undefined,
  });

  return prisma.corrigeType.create({
    data: {
      epreuveId,
      createdById,
      contenu: `${result.corrige}\n\n**Démarche :**\n${result.demarche}`,
      estPrincipal: false,
      statutValidation: "A_VALIDER",
    },
  });
};

// ---- Découpage en questions (chantier 2.1) ----

async function epreuveOuErreur(epreuveId: string) {
  const epreuve = await prisma.epreuve.findUnique({
    where: { id: epreuveId },
    include: { matiere: { select: { type: true } }, chapitre: { include: { cours: true } } },
  });
  if (!epreuve) throw new AppError("Épreuve introuvable", 404);
  return epreuve;
}

/** Notions rattachables à une question : celles des cours de la même matière. */
const notionsDeLaMatiere = (matiereId: string) =>
  prisma.notion.findMany({
    where: { chapitre: { cours: { matiereId } } },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });

export const listQuestionsEpreuve = async (epreuveId: string) => {
  const epreuve = await epreuveOuErreur(epreuveId);
  const [questions, notions] = await Promise.all([
    prisma.questionEpreuve.findMany({
      where: { epreuveId },
      include: { notion: true, corriges: { orderBy: { createdAt: "asc" } } },
      orderBy: { ordre: "asc" },
    }),
    notionsDeLaMatiere(epreuve.matiereId),
  ]);
  return { questions, notionsDisponibles: notions };
};

/**
 * Enregistre le découpage tel que l'admin l'a relu (vaut validation) : met à jour les
 * questions conservées, crée les nouvelles, supprime celles retirées (et leurs corrigés).
 */
export const remplacerQuestionsEpreuve = async (
  epreuveId: string,
  questions: { id?: string; numero: string; enonce: string; points: number; notionId?: string | null }[]
) => {
  const epreuve = await epreuveOuErreur(epreuveId);

  const notionIds = [...new Set(questions.map((q) => q.notionId).filter((id): id is string => !!id))];
  if (notionIds.length > 0) {
    const valides = await prisma.notion.count({
      where: { id: { in: notionIds }, chapitre: { cours: { matiereId: epreuve.matiereId } } },
    });
    if (valides !== notionIds.length) {
      throw new AppError("Une notion choisie n'appartient pas à la matière de cette épreuve", 400);
    }
  }
  const existantes = await prisma.questionEpreuve.findMany({ where: { epreuveId }, select: { id: true } });
  const idsExistants = new Set(existantes.map((q) => q.id));
  const idsConserves = questions.map((q) => q.id).filter((id): id is string => !!id);
  if (idsConserves.some((id) => !idsExistants.has(id))) {
    throw new AppError("Une question ne fait pas partie de cette épreuve", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.questionEpreuve.deleteMany({ where: { epreuveId, id: { notIn: idsConserves } } });
    for (const [ordre, q] of questions.entries()) {
      const data = { numero: q.numero, enonce: q.enonce, points: q.points, notionId: q.notionId ?? null, ordre };
      if (q.id) await tx.questionEpreuve.update({ where: { id: q.id }, data });
      else await tx.questionEpreuve.create({ data: { ...data, epreuveId } });
    }
  });
  return listQuestionsEpreuve(epreuveId);
};

const normaliser = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Proposition IA de découpage — rien n'est enregistré : l'admin corrige puis enregistre. */
export const proposerDecoupage = async (epreuveId: string, bareme?: number) => {
  const epreuve = await epreuveOuErreur(epreuveId);
  const notions = await notionsDeLaMatiere(epreuve.matiereId);
  const baremeVise = bareme ?? epreuve.bareme ?? undefined;

  const { questions } = await proposeExamSplit({
    parcours: epreuve.matiere.type,
    texteEpreuve: epreuve.enonce,
    notions: notions.map((n) => n.nom),
    bareme: baremeVise,
  });

  const parNom = new Map(notions.map((n) => [normaliser(n.nom), n]));
  const proposees = questions.map((q) => {
    const notion = q.notion ? parNom.get(normaliser(q.notion)) : undefined;
    return { numero: q.numero, enonce: q.enonce, points: q.points, notionId: notion?.id ?? null };
  });
  const total = proposees.reduce((s, q) => s + q.points, 0);
  return {
    questions: proposees,
    totalPoints: total,
    avertissement:
      baremeVise && Math.abs(total - baremeVise) > 0.001
        ? `Le total des points proposés (${total}) diffère du barème (${baremeVise}) : à ajuster.`
        : null,
  };
};

// ---- Corrigés par question ----

async function questionOuErreur(questionId: string) {
  const question = await prisma.questionEpreuve.findUnique({
    where: { id: questionId },
    include: { epreuve: { include: { chapitre: { include: { cours: true } } } } },
  });
  if (!question) throw new AppError("Question introuvable", 404);
  return question;
}

/** Corrigé saisi par un admin : déjà validé, comme le reste du contenu manuel. */
export const createCorrigeQuestion = async (
  questionId: string,
  createdById: string,
  data: { contenu: string; estPrincipal: boolean }
) => {
  await questionOuErreur(questionId);
  return prisma.corrigeQuestionEpreuve.create({
    data: { questionEpreuveId: questionId, createdById, ...data, statutValidation: "VALIDE" },
  });
};

/** Corrigé proposé par l'IA : A_VALIDER, jamais utilisé pour noter avant relecture. */
export const generateCorrigeQuestionIa = async (questionId: string, createdById: string) => {
  const question = await questionOuErreur(questionId);
  const chapitre = question.epreuve.chapitre;
  const result = await generateAnswerKey({
    enonceEpreuve:
      `Sujet complet :\n${question.epreuve.enonce}\n\n` +
      `Question à corriger — ${question.numero} (${question.points} points) :\n${question.enonce}`,
    contexteCours: chapitre?.contenuExtrait ?? chapitre?.cours.contenuExtrait ?? undefined,
  });
  return prisma.corrigeQuestionEpreuve.create({
    data: {
      questionEpreuveId: questionId,
      createdById,
      contenu: `${result.corrige}\n\n**Démarche :**\n${result.demarche}`,
      estPrincipal: false,
      statutValidation: "A_VALIDER",
    },
  });
};

export const updateCorrigeQuestion = async (
  id: string,
  data: { contenu?: string; estPrincipal?: boolean; statutValidation?: StatutValidation }
) => {
  const existing = await prisma.corrigeQuestionEpreuve.findUnique({ where: { id } });
  if (!existing) throw new AppError("Corrigé introuvable", 404);
  return prisma.corrigeQuestionEpreuve.update({ where: { id }, data });
};

export const deleteCorrigeQuestion = async (id: string) => {
  const existing = await prisma.corrigeQuestionEpreuve.findUnique({ where: { id } });
  if (!existing) throw new AppError("Corrigé introuvable", 404);
  await prisma.corrigeQuestionEpreuve.delete({ where: { id } });
};

export const listCorrigesQuestionsAValider = () =>
  prisma.corrigeQuestionEpreuve.findMany({
    where: { statutValidation: "A_VALIDER" },
    include: {
      questionEpreuve: {
        select: {
          numero: true,
          enonce: true,
          points: true,
          epreuve: { select: { id: true, enonce: true, examen: true, annee: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
