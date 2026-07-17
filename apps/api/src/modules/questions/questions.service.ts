import type { Difficulte, StatutQuestion } from "@prisma/client";
import { generateQcm, generateSaisieLibre } from "@kalyaro/ai-service";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";

async function assertNotionsBelongToChapitre(chapitreId: string, notionIds: string[]) {
  const notions = await prisma.notion.findMany({ where: { id: { in: notionIds }, chapitreId } });
  if (notions.length !== notionIds.length) {
    throw new AppError("Une ou plusieurs notions sont introuvables pour ce chapitre", 400);
  }
}

// ---- QCM ----

export const listQcmByChapitre = (chapitreId: string) =>
  prisma.questionQcm.findMany({
    where: { chapitreId },
    include: { notions: { include: { notion: true } } },
    orderBy: { createdAt: "desc" },
  });

/** Tous les QCM en attente de validation, tous chapitres confondus — file de validation. */
export const listQcmAValider = () =>
  prisma.questionQcm.findMany({
    where: { statut: "A_VALIDER" },
    include: { notions: { include: { notion: true } }, chapitre: true },
    orderBy: { createdAt: "desc" },
  });

export const createQcm = async (
  chapitreId: string,
  createdById: string,
  data: {
    enonce: string;
    choix: string[];
    bonneReponse: string;
    difficulte: Difficulte;
    notionIds: string[];
  }
) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id: chapitreId } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  await assertNotionsBelongToChapitre(chapitreId, data.notionIds);

  return prisma.questionQcm.create({
    data: {
      chapitreId,
      enonce: data.enonce,
      choix: data.choix,
      bonneReponse: data.bonneReponse,
      difficulte: data.difficulte,
      source: "MANUEL",
      statut: "PUBLIE",
      createdById,
      notions: { create: data.notionIds.map((notionId) => ({ notionId })) },
    },
    include: { notions: { include: { notion: true } } },
  });
};

export const updateQcm = async (
  id: string,
  data: {
    enonce?: string;
    choix?: string[];
    bonneReponse?: string;
    difficulte?: Difficulte;
    statut?: StatutQuestion;
    notionIds?: string[];
  }
) => {
  const existing = await prisma.questionQcm.findUnique({ where: { id } });
  if (!existing) throw new AppError("Question QCM introuvable", 404);

  const { notionIds, ...rest } = data;
  return prisma.$transaction(async (tx) => {
    if (notionIds) {
      const notions = await tx.notion.findMany({
        where: { id: { in: notionIds }, chapitreId: existing.chapitreId },
      });
      if (notions.length !== notionIds.length) {
        throw new AppError("Une ou plusieurs notions sont introuvables pour ce chapitre", 400);
      }
      await tx.questionQcmNotion.deleteMany({ where: { questionQcmId: id } });
      await tx.questionQcmNotion.createMany({
        data: notionIds.map((notionId) => ({ questionQcmId: id, notionId })),
      });
    }
    return tx.questionQcm.update({
      where: { id },
      data: rest,
      include: { notions: { include: { notion: true } } },
    });
  });
};

export const deleteQcm = async (id: string) => {
  const existing = await prisma.questionQcm.findUnique({ where: { id } });
  if (!existing) throw new AppError("Question QCM introuvable", 404);
  await prisma.questionQcm.delete({ where: { id } });
};

/** Génère des QCM via l'IA à partir du texte extrait du cours ; statut A_VALIDER,
 * source IA — jamais visible aux élèves sans validation admin (PATCH statut -> PUBLIE). */
export const generateQcmForChapitre = async (
  chapitreId: string,
  createdById: string,
  nombreQuestions: number
) => {
  const chapitre = await prisma.chapitre.findUnique({
    where: { id: chapitreId },
    include: { cours: true, notions: true },
  });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  const texteCours = chapitre.contenuExtrait ?? chapitre.cours.contenuExtrait;
  if (!texteCours) {
    throw new AppError("Le texte du cours n'a pas encore été extrait", 400);
  }

  const result = await generateQcm({
    chapitreTitre: chapitre.titre,
    texteCours,
    notionsExistantes: chapitre.notions.map((n) => n.nom),
    nombreQuestions,
  });

  const created = [];
  for (const q of result.questions) {
    let notion = await prisma.notion.findFirst({ where: { chapitreId, nom: q.notionTag } });
    if (!notion) {
      notion = await prisma.notion.create({ data: { chapitreId, nom: q.notionTag } });
    }
    created.push(
      await prisma.questionQcm.create({
        data: {
          chapitreId,
          enonce: q.enonce,
          choix: q.choix,
          bonneReponse: q.bonneReponse,
          difficulte: q.difficulte,
          source: "IA",
          statut: "A_VALIDER",
          createdById,
          notions: { create: [{ notionId: notion.id }] },
        },
        include: { notions: { include: { notion: true } } },
      })
    );
  }
  return created;
};

// ---- Saisie libre ----

export const listSaisieLibreByChapitre = (chapitreId: string) =>
  prisma.questionSaisieLibre.findMany({
    where: { chapitreId },
    include: { notions: { include: { notion: true } } },
    orderBy: { createdAt: "desc" },
  });

/** Toutes les questions à saisie libre en attente de validation — file de validation. */
export const listSaisieLibreAValider = () =>
  prisma.questionSaisieLibre.findMany({
    where: { statut: "A_VALIDER" },
    include: { notions: { include: { notion: true } }, chapitre: true },
    orderBy: { createdAt: "desc" },
  });

export const createSaisieLibre = async (
  chapitreId: string,
  createdById: string,
  data: { enonce: string; reponseReference: string; notionIds: string[] }
) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id: chapitreId } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  await assertNotionsBelongToChapitre(chapitreId, data.notionIds);

  return prisma.questionSaisieLibre.create({
    data: {
      chapitreId,
      enonce: data.enonce,
      reponseReference: data.reponseReference,
      source: "MANUEL",
      statut: "PUBLIE",
      createdById,
      notions: { create: data.notionIds.map((notionId) => ({ notionId })) },
    },
    include: { notions: { include: { notion: true } } },
  });
};

export const updateSaisieLibre = async (
  id: string,
  data: {
    enonce?: string;
    reponseReference?: string;
    statut?: StatutQuestion;
    notionIds?: string[];
  }
) => {
  const existing = await prisma.questionSaisieLibre.findUnique({ where: { id } });
  if (!existing) throw new AppError("Question à saisie libre introuvable", 404);

  const { notionIds, ...rest } = data;
  return prisma.$transaction(async (tx) => {
    if (notionIds) {
      const notions = await tx.notion.findMany({
        where: { id: { in: notionIds }, chapitreId: existing.chapitreId },
      });
      if (notions.length !== notionIds.length) {
        throw new AppError("Une ou plusieurs notions sont introuvables pour ce chapitre", 400);
      }
      await tx.questionSaisieLibreNotion.deleteMany({ where: { questionSaisieLibreId: id } });
      await tx.questionSaisieLibreNotion.createMany({
        data: notionIds.map((notionId) => ({ questionSaisieLibreId: id, notionId })),
      });
    }
    return tx.questionSaisieLibre.update({
      where: { id },
      data: rest,
      include: { notions: { include: { notion: true } } },
    });
  });
};

export const deleteSaisieLibre = async (id: string) => {
  const existing = await prisma.questionSaisieLibre.findUnique({ where: { id } });
  if (!existing) throw new AppError("Question à saisie libre introuvable", 404);
  await prisma.questionSaisieLibre.delete({ where: { id } });
};

/** Génère des questions à saisie libre via l'IA à partir du texte extrait du cours ;
 * statut A_VALIDER, source IA — même pattern que generateQcmForChapitre. */
export const generateSaisieLibreForChapitre = async (
  chapitreId: string,
  createdById: string,
  nombreQuestions: number
) => {
  const chapitre = await prisma.chapitre.findUnique({
    where: { id: chapitreId },
    include: { cours: true, notions: true },
  });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  const texteCours = chapitre.contenuExtrait ?? chapitre.cours.contenuExtrait;
  if (!texteCours) {
    throw new AppError("Le texte du cours n'a pas encore été extrait", 400);
  }

  const result = await generateSaisieLibre({
    chapitreTitre: chapitre.titre,
    texteCours,
    notionsExistantes: chapitre.notions.map((n) => n.nom),
    nombreQuestions,
  });

  const created = [];
  for (const q of result.questions) {
    let notion = await prisma.notion.findFirst({ where: { chapitreId, nom: q.notionTag } });
    if (!notion) {
      notion = await prisma.notion.create({ data: { chapitreId, nom: q.notionTag } });
    }
    created.push(
      await prisma.questionSaisieLibre.create({
        data: {
          chapitreId,
          enonce: q.enonce,
          reponseReference: q.reponseReference,
          source: "IA",
          statut: "A_VALIDER",
          createdById,
          notions: { create: [{ notionId: notion.id }] },
        },
        include: { notions: { include: { notion: true } } },
      })
    );
  }
  return created;
};
