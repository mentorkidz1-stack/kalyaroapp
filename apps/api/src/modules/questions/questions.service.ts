import type { Difficulte, StatutQuestion, TypeReponseQcm } from "@prisma/client";
import { libelleReponseAttendue, verifierQuestionSurFigure, type ReponseAttendue } from "@kalyaro/shared";
import { generateQcm, generateQcmVariants, generateSaisieLibre } from "@kalyaro/ai-service";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";
import { figureIaValide, figurePourPrisma } from "../../lib/figures.js";

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
    include: { notions: { include: { notion: true } }, _count: { select: { variantes: true } } },
    orderBy: { createdAt: "desc" },
  });

/** Tous les QCM en attente de validation, tous chapitres confondus — file de validation. */
export const listQcmAValider = () =>
  prisma.questionQcm.findMany({
    where: { statut: "A_VALIDER" },
    include: {
      notions: { include: { notion: true } },
      chapitre: true,
      varianteDe: { select: { id: true, enonce: true, choix: true, bonneReponse: true, figure: true } },
    },
    orderBy: { createdAt: "desc" },
  });

export const createQcm = async (
  chapitreId: string,
  createdById: string,
  data: {
    enonce: string;
    typeReponse: TypeReponseQcm;
    choix: string[];
    bonneReponse: string;
    reponseAttendue?: ReponseAttendue;
    difficulte: Difficulte;
    notionIds: string[];
    figure?: unknown;
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
      typeReponse: data.typeReponse,
      reponseAttendue: data.reponseAttendue ?? undefined,
      difficulte: data.difficulte,
      figure: figurePourPrisma(data.figure ?? undefined),
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
    figure?: unknown;
    reponseAttendue?: ReponseAttendue;
  }
) => {
  const existing = await prisma.questionQcm.findUnique({ where: { id } });
  if (!existing) throw new AppError("Question QCM introuvable", 404);

  const { notionIds, figure, reponseAttendue, ...autres } = data;
  // Question sur figure : la combinaison finale (figure + réponse attendue) doit rester cohérente.
  if (existing.typeReponse !== "CHOIX" && (figure !== undefined || reponseAttendue !== undefined)) {
    const erreurs = verifierQuestionSurFigure(
      existing.typeReponse,
      figure !== undefined ? figure : existing.figure,
      reponseAttendue ?? existing.reponseAttendue
    );
    if (erreurs.length) throw new AppError(erreurs.join(" ; "), 400);
  }
  const rest = {
    ...autres,
    ...(figure !== undefined ? { figure: figurePourPrisma(figure) } : {}),
    ...(reponseAttendue && existing.typeReponse !== "CHOIX"
      ? { reponseAttendue, bonneReponse: libelleReponseAttendue(reponseAttendue) }
      : {}),
  };
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
          figure: figurePourPrisma(figureIaValide(q.figure)),
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

// ---- Variantes de QCM (chantier 1.3) ----

const MAX_VARIANTES_PAR_QUESTION = 10;

/**
 * Génère par IA des variantes d'une question publiée (autres valeurs, même méthode). Elles
 * sont créées en A_VALIDER : un humain vérifie le corrigé avant qu'un étudiant ne les voie.
 * Une variante pointe toujours vers la question racine, même si on part d'une variante.
 */
export const generateVariantesForQcm = async (questionId: string, createdById: string, nombre: number) => {
  const question = await prisma.questionQcm.findUnique({
    where: { id: questionId },
    include: { notions: { include: { notion: true } } },
  });
  if (!question) throw new AppError("Question QCM introuvable", 404);
  if (question.statut !== "PUBLIE") {
    throw new AppError("Seule une question publiée peut servir de modèle à des variantes", 400);
  }
  if (question.typeReponse !== "CHOIX") {
    throw new AppError("Les variantes IA ne sont disponibles que pour les QCM à choix (pas les réponses sur figure)", 400);
  }

  const racineId = question.varianteDeId ?? question.id;
  const existantes = await prisma.questionQcm.count({ where: { varianteDeId: racineId } });
  const aGenerer = Math.min(nombre, MAX_VARIANTES_PAR_QUESTION - existantes);
  if (aGenerer <= 0) {
    throw new AppError(`Cette question a déjà ${existantes} variantes (maximum ${MAX_VARIANTES_PAR_QUESTION})`, 400);
  }

  const { variantes } = await generateQcmVariants({
    notionNom: question.notions.map((n) => n.notion.nom).join(", ") || "notion du chapitre",
    enonceOriginal: question.enonce,
    choixOriginal: question.choix as string[],
    bonneReponseOriginal: question.bonneReponse,
    nombreVariantes: aGenerer,
    figureOriginale: question.figure ?? undefined,
  });

  const created = [];
  for (const v of variantes.slice(0, aGenerer)) {
    created.push(
      await prisma.questionQcm.create({
        data: {
          chapitreId: question.chapitreId,
          enonce: v.enonce,
          choix: v.choix,
          bonneReponse: v.bonneReponse,
          difficulte: question.difficulte,
          figure: figurePourPrisma(figureIaValide(v.figure)),
          source: "IA",
          statut: "A_VALIDER",
          createdById,
          varianteDeId: racineId,
          notions: { create: question.notions.map((n) => ({ notionId: n.notionId })) },
        },
        include: { notions: { include: { notion: true } } },
      })
    );
  }
  return created;
};

/**
 * Variantes en lot pour un chapitre : complète chaque question racine publiée jusqu'à
 * `nombre` variantes (publiées ou en attente). Les appels IA sont faits un par un (quotas
 * du tier gratuit) ; un échec sur une question n'arrête pas le lot.
 */
export const generateVariantesForChapitre = async (chapitreId: string, createdById: string, nombre: number) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id: chapitreId } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);

  const racines = await prisma.questionQcm.findMany({
    where: { chapitreId, statut: "PUBLIE", varianteDeId: null, typeReponse: "CHOIX" },
    include: { _count: { select: { variantes: true } } },
    orderBy: { createdAt: "asc" },
  });

  let variantesCreees = 0;
  let questionsCompletes = 0;
  const echecs: { questionId: string; enonce: string; erreur: string }[] = [];
  for (const racine of racines) {
    const manquantes = nombre - racine._count.variantes;
    if (manquantes <= 0) {
      questionsCompletes++;
      continue;
    }
    try {
      variantesCreees += (await generateVariantesForQcm(racine.id, createdById, manquantes)).length;
    } catch (err) {
      echecs.push({
        questionId: racine.id,
        enonce: racine.enonce,
        erreur: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { questionsTraitees: racines.length, questionsCompletes, variantesCreees, echecs };
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
  data: { enonce: string; reponseReference: string; notionIds: string[]; figure?: unknown }
) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id: chapitreId } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  await assertNotionsBelongToChapitre(chapitreId, data.notionIds);

  return prisma.questionSaisieLibre.create({
    data: {
      chapitreId,
      enonce: data.enonce,
      reponseReference: data.reponseReference,
      figure: figurePourPrisma(data.figure ?? undefined),
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
    figure?: unknown;
  }
) => {
  const existing = await prisma.questionSaisieLibre.findUnique({ where: { id } });
  if (!existing) throw new AppError("Question à saisie libre introuvable", 404);

  const { notionIds, figure, ...autres } = data;
  const rest = { ...autres, ...(figure !== undefined ? { figure: figurePourPrisma(figure) } : {}) };
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
          figure: figurePourPrisma(figureIaValide(q.figure)),
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
