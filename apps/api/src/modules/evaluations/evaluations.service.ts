import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";
import { savePdfFile, getPdfFileStream, pdfFileExists, deletePdfFile } from "../../lib/pdf-upload.js";
import { saveImageFile, getImageFileStream, imageFileExists, getImageContentType } from "../../lib/image-upload.js";
import { assertMatiereAccessible } from "../../lib/matiere-access.js";
import { recordDailyActivity } from "../../lib/streak.js";
import { generateEvaluationFeedback } from "@kalyaro/ai-service";

// ---- Admin ----

export async function createEvaluation(
  matiereId: string,
  createdById: string,
  fields: { titre: string; chapitreId?: string; enonce?: string; dureeMinutes: number; bareme: number },
  pdf?: { filename: string; buffer: Buffer }
) {
  const matiere = await prisma.matiere.findUnique({ where: { id: matiereId } });
  if (!matiere) throw new AppError("Matière introuvable", 404);

  if (!fields.enonce && !pdf) {
    throw new AppError("Fournis un énoncé (texte) ou un fichier PDF", 400);
  }

  let fichierPdfUrl: string | null = null;
  let contenuExtrait: string | null = fields.enonce ?? null;
  let statutExtraction: "DONE" | "ERROR" | null = null;
  if (pdf) {
    const saved = await savePdfFile(pdf.filename, pdf.buffer);
    fichierPdfUrl = saved.storedFilename;
    contenuExtrait = fields.enonce ?? saved.contenuExtrait;
    statutExtraction = saved.statutExtraction;
  }

  return prisma.evaluation.create({
    data: {
      matiereId,
      chapitreId: fields.chapitreId,
      titre: fields.titre,
      enonce: fields.enonce ?? null,
      fichierPdfUrl,
      contenuExtrait,
      statutExtraction,
      dureeMinutes: fields.dureeMinutes,
      bareme: fields.bareme,
      createdById,
    },
  });
}

export const listEvaluationsByMatiere = (matiereId: string) =>
  prisma.evaluation.findMany({ where: { matiereId }, orderBy: { createdAt: "desc" } });

export const getEvaluation = async (id: string) => {
  const evaluation = await prisma.evaluation.findUnique({ where: { id } });
  if (!evaluation) throw new AppError("Évaluation introuvable", 404);
  return evaluation;
};

export const updateEvaluation = async (
  id: string,
  data: { titre?: string; chapitreId?: string | null; dureeMinutes?: number; bareme?: number }
) => {
  const evaluation = await prisma.evaluation.findUnique({ where: { id } });
  if (!evaluation) throw new AppError("Évaluation introuvable", 404);
  return prisma.evaluation.update({ where: { id }, data });
};

export const deleteEvaluation = async (id: string) => {
  const evaluation = await prisma.evaluation.findUnique({ where: { id } });
  if (!evaluation) throw new AppError("Évaluation introuvable", 404);
  await prisma.evaluation.delete({ where: { id } });
  if (evaluation.fichierPdfUrl) await deletePdfFile(evaluation.fichierPdfUrl);
};

export const getEvaluationPdfStream = async (id: string) => {
  const evaluation = await prisma.evaluation.findUnique({ where: { id } });
  if (!evaluation?.fichierPdfUrl) throw new AppError("Aucun fichier PDF pour cette évaluation", 404);
  if (!(await pdfFileExists(evaluation.fichierPdfUrl))) throw new AppError("Fichier PDF introuvable sur le serveur", 404);
  return { stream: await getPdfFileStream(evaluation.fichierPdfUrl), titre: evaluation.titre };
};

export const getEvaluationPdfStreamForEleve = async (eleveId: string, evaluationId: string) => {
  const evaluation = await prisma.evaluation.findUnique({ where: { id: evaluationId } });
  if (!evaluation) throw new AppError("Évaluation introuvable", 404);
  await assertMatiereAccessible(eleveId, evaluation.matiereId);
  if (!evaluation.fichierPdfUrl) throw new AppError("Aucun fichier PDF pour cette évaluation", 404);
  if (!(await pdfFileExists(evaluation.fichierPdfUrl))) throw new AppError("Fichier PDF introuvable sur le serveur", 404);
  return { stream: await getPdfFileStream(evaluation.fichierPdfUrl), titre: evaluation.titre };
};

export const listCopiesACorriger = () =>
  prisma.copieEvaluation.findMany({
    where: { statut: "SOUMIS" },
    include: { evaluation: true, eleve: true },
    orderBy: { soumisAt: "asc" },
  });

export const listCopiesCorrigees = () =>
  prisma.copieEvaluation.findMany({
    where: { statut: "CORRIGE" },
    include: { evaluation: true, eleve: true },
    orderBy: { corrigeAt: "desc" },
  });

export const getCopieAdmin = async (id: string) => {
  const copie = await prisma.copieEvaluation.findUnique({
    where: { id },
    include: { evaluation: true, eleve: true },
  });
  if (!copie) throw new AppError("Copie introuvable", 404);
  return copie;
};

export const corrigerCopie = async (
  id: string,
  adminId: string,
  data: {
    noteObtenue: number;
    commentaireAdmin?: string;
    pointsForts?: string[];
    pointsATravailler?: string[];
  }
) => {
  const copie = await prisma.copieEvaluation.findUnique({ where: { id }, include: { evaluation: true } });
  if (!copie) throw new AppError("Copie introuvable", 404);
  if (copie.statut !== "SOUMIS") {
    throw new AppError("Cette copie n'a pas encore été soumise par l'élève", 409);
  }
  if (data.noteObtenue > copie.evaluation.bareme) {
    throw new AppError(`La note ne peut pas dépasser le barème (${copie.evaluation.bareme})`, 400);
  }

  return prisma.copieEvaluation.update({
    where: { id },
    data: {
      statut: "CORRIGE",
      noteObtenue: data.noteObtenue,
      commentaireAdmin: data.commentaireAdmin,
      pointsForts: data.pointsForts ?? [],
      pointsATravailler: data.pointsATravailler ?? [],
      corrigeParId: adminId,
      corrigeAt: new Date(),
    },
  });
};

export const genererFeedbackIa = async (
  id: string,
  data: { noteObtenue: number; indicationAdmin?: string }
) => {
  const copie = await prisma.copieEvaluation.findUnique({ where: { id }, include: { evaluation: true } });
  if (!copie) throw new AppError("Copie introuvable", 404);
  if (copie.statut !== "SOUMIS") {
    throw new AppError("Cette copie n'a pas encore été soumise par l'élève", 409);
  }
  if (!copie.reponseDonnee) {
    throw new AppError("Cette copie n'a pas de réponse à évaluer", 400);
  }
  if (data.noteObtenue > copie.evaluation.bareme) {
    throw new AppError(`La note ne peut pas dépasser le barème (${copie.evaluation.bareme})`, 400);
  }

  return generateEvaluationFeedback({
    enonce: copie.evaluation.enonce ?? copie.evaluation.contenuExtrait ?? "",
    reponseEleve: copie.reponseDonnee,
    noteObtenue: data.noteObtenue,
    bareme: copie.evaluation.bareme,
    indicationAdmin: data.indicationAdmin,
  });
};

// ---- Élève ----

export const listEvaluationsForEleve = async (eleveId: string, matiereId: string) => {
  await assertMatiereAccessible(eleveId, matiereId);
  const evaluations = await prisma.evaluation.findMany({
    where: { matiereId },
    orderBy: { createdAt: "desc" },
  });
  const copies = await prisma.copieEvaluation.findMany({
    where: { eleveId, evaluationId: { in: evaluations.map((e) => e.id) } },
  });
  const copieByEvaluation = new Map(copies.map((c) => [c.evaluationId, c]));

  return evaluations.map((e) => ({
    id: e.id,
    titre: e.titre,
    dureeMinutes: e.dureeMinutes,
    bareme: e.bareme,
    maCopie: copieByEvaluation.get(e.id) ?? null,
  }));
};

export const demarrerCopie = async (eleveId: string, evaluationId: string) => {
  const evaluation = await prisma.evaluation.findUnique({ where: { id: evaluationId } });
  if (!evaluation) throw new AppError("Évaluation introuvable", 404);

  const existing = await prisma.copieEvaluation.findUnique({
    where: { evaluationId_eleveId: { evaluationId, eleveId } },
  });
  if (existing) {
    if (existing.statut !== "EN_COURS") {
      throw new AppError("Tu as déjà passé cette évaluation", 409);
    }
    return buildEleveCopieResponse(existing, evaluation);
  }

  const dateLimiteAt = new Date(Date.now() + evaluation.dureeMinutes * 60_000);
  try {
    const copie = await prisma.copieEvaluation.create({
      data: { evaluationId, eleveId, dateLimiteAt },
    });
    return buildEleveCopieResponse(copie, evaluation);
  } catch (err) {
    // Deux requêtes de démarrage quasi simultanées (double-clic, StrictMode en dev,
    // retry réseau) peuvent toutes deux dépasser le check `existing` ci-dessus avant
    // qu'aucune n'ait écrit — la contrainte unique tranche laquelle gagne. Au lieu de
    // remonter une erreur générique à la perdante, on lui renvoie la copie créée par
    // l'autre : l'appelant ne doit jamais voir cette course interne.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raceWinner = await prisma.copieEvaluation.findUniqueOrThrow({
        where: { evaluationId_eleveId: { evaluationId, eleveId } },
      });
      return buildEleveCopieResponse(raceWinner, evaluation);
    }
    throw err;
  }
};

export const getCopieForEleve = async (eleveId: string, copieId: string) => {
  const copie = await prisma.copieEvaluation.findUnique({ where: { id: copieId }, include: { evaluation: true } });
  if (!copie || copie.eleveId !== eleveId) throw new AppError("Copie introuvable", 404);
  return buildEleveCopieResponse(copie, copie.evaluation);
};

export const soumettreCopie = async (
  eleveId: string,
  copieId: string,
  reponseDonnee: string,
  photos: { filename: string; buffer: Buffer }[] = []
) => {
  const copie = await prisma.copieEvaluation.findUnique({ where: { id: copieId }, include: { evaluation: true } });
  if (!copie || copie.eleveId !== eleveId) throw new AppError("Copie introuvable", 404);
  if (copie.statut !== "EN_COURS") throw new AppError("Cette copie a déjà été soumise", 409);

  const saved = await Promise.all(photos.map((photo) => saveImageFile(photo.filename, photo.buffer)));
  const reponsePhotoUrls = saved.map((s) => s.storedFilename);

  const horsDelai = new Date() > copie.dateLimiteAt;
  const updated = await prisma.copieEvaluation.update({
    where: { id: copieId },
    data: { statut: "SOUMIS", reponseDonnee, reponsePhotoUrls, soumisAt: new Date(), horsDelai },
  });
  await recordDailyActivity(eleveId);
  return buildEleveCopieResponse(updated, copie.evaluation);
};

const resolveCopiePhoto = async (copie: { reponsePhotoUrls: string[] }, index: number) => {
  const storedFilename = copie.reponsePhotoUrls[index];
  if (!storedFilename) throw new AppError("Photo introuvable", 404);
  if (!(await imageFileExists(storedFilename))) throw new AppError("Fichier photo introuvable sur le serveur", 404);
  return { stream: await getImageFileStream(storedFilename), contentType: getImageContentType(storedFilename) };
};

export const getCopiePhotoStreamAdmin = async (copieId: string, index: number) => {
  const copie = await prisma.copieEvaluation.findUnique({ where: { id: copieId } });
  if (!copie) throw new AppError("Copie introuvable", 404);
  return resolveCopiePhoto(copie, index);
};

export const getCopiePhotoStreamForEleve = async (eleveId: string, copieId: string, index: number) => {
  const copie = await prisma.copieEvaluation.findUnique({ where: { id: copieId } });
  if (!copie || copie.eleveId !== eleveId) throw new AppError("Copie introuvable", 404);
  return resolveCopiePhoto(copie, index);
};

function buildEleveCopieResponse(
  copie: {
    id: string;
    statut: "EN_COURS" | "SOUMIS" | "CORRIGE";
    dateLimiteAt: Date;
    reponseDonnee: string | null;
    reponsePhotoUrls: string[];
    horsDelai: boolean;
    noteObtenue: number | null;
    commentaireAdmin: string | null;
    pointsForts: string[];
    pointsATravailler: string[];
  },
  evaluation: {
    id: string;
    titre: string;
    enonce: string | null;
    fichierPdfUrl: string | null;
    dureeMinutes: number;
    bareme: number;
  }
) {
  return {
    copieId: copie.id,
    statut: copie.statut,
    dateLimiteAt: copie.dateLimiteAt,
    reponseDonnee: copie.reponseDonnee,
    reponsePhotoUrls: copie.reponsePhotoUrls,
    horsDelai: copie.horsDelai,
    noteObtenue: copie.noteObtenue,
    commentaireAdmin: copie.commentaireAdmin,
    pointsForts: copie.pointsForts,
    pointsATravailler: copie.pointsATravailler,
    evaluation: {
      id: evaluation.id,
      titre: evaluation.titre,
      enonce: evaluation.enonce,
      aUnPdf: !!evaluation.fichierPdfUrl,
      dureeMinutes: evaluation.dureeMinutes,
      bareme: evaluation.bareme,
    },
  };
}
