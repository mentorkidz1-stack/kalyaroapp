import type { SourceCorrige, StatutValidation } from "@prisma/client";
import { generateAnswerKey } from "@kalyaro/ai-service";
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
    include: { corriges: true, notionPrincipale: true },
    orderBy: { createdAt: "desc" },
  });

export const createEpreuve = async (
  matiereId: string,
  createdById: string,
  data: {
    chapitreId?: string;
    notionPrincipaleId?: string;
    enonce: string;
    sourceCorrige: SourceCorrige;
  }
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
  data: { chapitreId?: string; notionPrincipaleId?: string; sourceCorrige: SourceCorrige },
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
  }
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
