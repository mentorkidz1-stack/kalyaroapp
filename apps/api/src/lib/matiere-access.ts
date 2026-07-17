import { prisma } from "../db/prisma.js";
import { AppError } from "../plugins/error-handler.js";

export async function getAccessibleMatiereIds(eleveId: string): Promise<string[]> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: eleveId } });

  if (user.classeId) {
    const matieres = await prisma.matiereScolaire.findMany({
      where: { classeId: user.classeId },
      select: { id: true },
    });
    return matieres.map((m) => m.id);
  }
  if (user.niveauUniversitaireId) {
    const matieres = await prisma.uEMatiere.findMany({
      where: { niveauUniversitaireId: user.niveauUniversitaireId },
      select: { id: true },
    });
    return matieres.map((m) => m.id);
  }
  return [];
}

export async function assertMatiereAccessible(eleveId: string, matiereId: string): Promise<void> {
  const matiereIds = await getAccessibleMatiereIds(eleveId);
  if (!matiereIds.includes(matiereId)) {
    throw new AppError("Matière introuvable", 404);
  }
}
