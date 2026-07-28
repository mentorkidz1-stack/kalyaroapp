import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";
import { savePdfFile, getPdfFileStream, pdfFileExists, deletePdfFile } from "../../lib/pdf-upload.js";

export async function saveCoursPdf(input: {
  titre: string;
  matiereId: string;
  createdById: string;
  filename: string;
  buffer: Buffer;
}) {
  const matiere = await prisma.matiere.findUnique({ where: { id: input.matiereId } });
  if (!matiere) throw new AppError("Matière introuvable", 404);

  const { storedFilename, contenuExtrait, statutExtraction } = await savePdfFile(input.filename, input.buffer);

  return prisma.cours.create({
    data: {
      matiereId: input.matiereId,
      titre: input.titre,
      fichierPdfUrl: storedFilename,
      contenuExtrait,
      statutExtraction,
      createdById: input.createdById,
    },
  });
}

export const listCours = () => prisma.cours.findMany({ orderBy: { createdAt: "desc" } });

export const getCours = async (id: string) => {
  const cours = await prisma.cours.findUnique({ where: { id }, include: { chapitres: true } });
  if (!cours) throw new AppError("Cours introuvable", 404);
  return cours;
};

export const updateCours = async (id: string, data: { titre?: string; matiereId?: string }) => {
  const cours = await prisma.cours.findUnique({ where: { id } });
  if (!cours) throw new AppError("Cours introuvable", 404);
  if (data.matiereId) {
    const matiere = await prisma.matiere.findUnique({ where: { id: data.matiereId } });
    if (!matiere) throw new AppError("Matière introuvable", 404);
  }
  return prisma.cours.update({ where: { id }, data });
};

export const deleteCours = async (id: string) => {
  const cours = await prisma.cours.findUnique({ where: { id } });
  if (!cours) throw new AppError("Cours introuvable", 404);
  await prisma.cours.delete({ where: { id } });
  await deletePdfFile(cours.fichierPdfUrl);
};

export const getCoursPdfStream = async (id: string) => {
  const cours = await prisma.cours.findUnique({ where: { id } });
  if (!cours) throw new AppError("Cours introuvable", 404);
  if (!(await pdfFileExists(cours.fichierPdfUrl))) throw new AppError("Fichier PDF introuvable sur le serveur", 404);
  return { stream: await getPdfFileStream(cours.fichierPdfUrl), titre: cours.titre };
};

// ---- Chapitres ----

export const createChapitre = async (
  coursId: string,
  data: { titre: string; ordre?: number }
) => {
  const cours = await prisma.cours.findUnique({ where: { id: coursId } });
  if (!cours) throw new AppError("Cours introuvable", 404);
  return prisma.chapitre.create({ data: { coursId, titre: data.titre, ordre: data.ordre ?? 0 } });
};

export const getChapitre = async (id: string) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  return chapitre;
};

export const updateChapitre = async (id: string, data: { titre?: string; ordre?: number }) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  return prisma.chapitre.update({ where: { id }, data });
};

export const deleteChapitre = async (id: string) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  await prisma.chapitre.delete({ where: { id } });
  if (chapitre.fichierPdfUrl) await deletePdfFile(chapitre.fichierPdfUrl);
};

export const saveChapitrePdf = async (chapitreId: string, filename: string, buffer: Buffer) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id: chapitreId } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);

  if (chapitre.fichierPdfUrl) await deletePdfFile(chapitre.fichierPdfUrl);
  const { storedFilename, contenuExtrait, statutExtraction } = await savePdfFile(filename, buffer);

  return prisma.chapitre.update({
    where: { id: chapitreId },
    data: { fichierPdfUrl: storedFilename, contenuExtrait, statutExtraction },
  });
};
