import { proposePrerequisiteGraph } from "@kalyaro/ai-service";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";

// ---- Notions ----

export const listNotionsByChapitre = async (chapitreId: string) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id: chapitreId } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  return prisma.notion.findMany({ where: { chapitreId }, orderBy: { nom: "asc" } });
};

export const createNotion = async (
  chapitreId: string,
  data: { nom: string; description?: string }
) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id: chapitreId } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  return prisma.notion.create({ data: { chapitreId, nom: data.nom, description: data.description } });
};

export const updateNotion = async (id: string, data: { nom?: string; description?: string }) => {
  const notion = await prisma.notion.findUnique({ where: { id } });
  if (!notion) throw new AppError("Notion introuvable", 404);
  return prisma.notion.update({ where: { id }, data });
};

export const deleteNotion = async (id: string) => {
  const notion = await prisma.notion.findUnique({ where: { id } });
  if (!notion) throw new AppError("Notion introuvable", 404);
  await prisma.notion.delete({ where: { id } });
};

// ---- Graphe de prérequis ----

export const listPrerequisByChapitre = async (chapitreId: string) => {
  const chapitre = await prisma.chapitre.findUnique({ where: { id: chapitreId } });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  return prisma.prerequis.findMany({
    where: { notion: { chapitreId } },
    include: { notion: true, prerequisNotion: true },
  });
};

/** BFS : `prerequisNotionId` dépend-il déjà, directement ou transitivement, de `notionId` ?
 * Si oui, ajouter l'arête notionId -> prerequisNotionId créerait un cycle. */
async function wouldCreateCycle(notionId: string, prerequisNotionId: string): Promise<boolean> {
  if (notionId === prerequisNotionId) return true;
  const visited = new Set<string>();
  let frontier = [prerequisNotionId];
  while (frontier.length > 0) {
    const edges = await prisma.prerequis.findMany({
      where: { notionId: { in: frontier } },
      select: { prerequisNotionId: true },
    });
    frontier = [];
    for (const edge of edges) {
      if (edge.prerequisNotionId === notionId) return true;
      if (!visited.has(edge.prerequisNotionId)) {
        visited.add(edge.prerequisNotionId);
        frontier.push(edge.prerequisNotionId);
      }
    }
  }
  return false;
}

export const createPrerequis = async (data: { notionId: string; prerequisNotionId: string }) => {
  const [notion, prerequisNotion] = await Promise.all([
    prisma.notion.findUnique({ where: { id: data.notionId } }),
    prisma.notion.findUnique({ where: { id: data.prerequisNotionId } }),
  ]);
  if (!notion || !prerequisNotion) throw new AppError("Notion introuvable", 404);
  if (data.notionId === data.prerequisNotionId) {
    throw new AppError("Une notion ne peut pas être son propre prérequis", 400);
  }
  if (await wouldCreateCycle(data.notionId, data.prerequisNotionId)) {
    throw new AppError("Cette arête créerait un cycle dans le graphe de prérequis", 400);
  }
  // Créée directement par un admin -> déjà validée (même logique que les questions manuelles).
  // Le statut PROPOSE_IA reste réservé aux arêtes issues de proposeGraphForChapitre.
  return prisma.prerequis.create({ data: { ...data, statut: "VALIDE_ADMIN" } });
};

export const validatePrerequis = async (notionId: string, prerequisNotionId: string) => {
  const key = { notionId_prerequisNotionId: { notionId, prerequisNotionId } };
  const edge = await prisma.prerequis.findUnique({ where: key });
  if (!edge) throw new AppError("Arête introuvable", 404);
  return prisma.prerequis.update({ where: key, data: { statut: "VALIDE_ADMIN" } });
};

export const deletePrerequis = async (notionId: string, prerequisNotionId: string) => {
  const key = { notionId_prerequisNotionId: { notionId, prerequisNotionId } };
  const edge = await prisma.prerequis.findUnique({ where: key });
  if (!edge) throw new AppError("Arête introuvable", 404);
  await prisma.prerequis.delete({ where: key });
};

// ---- Proposition IA du graphe (à partir du texte extrait du cours) ----

export const proposeGraphForChapitre = async (chapitreId: string) => {
  const chapitre = await prisma.chapitre.findUnique({
    where: { id: chapitreId },
    include: { cours: true },
  });
  if (!chapitre) throw new AppError("Chapitre introuvable", 404);
  if (!chapitre.cours.contenuExtrait) {
    throw new AppError("Le texte du cours n'a pas encore été extrait", 400);
  }

  const proposal = await proposePrerequisiteGraph({
    chapitreTitre: chapitre.titre,
    texteCours: chapitre.cours.contenuExtrait,
  });

  return prisma.$transaction(async (tx) => {
    const notionIdByNom = new Map<string, string>();
    for (const n of proposal.notions) {
      const existing = await tx.notion.findFirst({ where: { chapitreId, nom: n.nom } });
      const notion =
        existing ?? (await tx.notion.create({ data: { chapitreId, nom: n.nom, description: n.description } }));
      notionIdByNom.set(n.nom, notion.id);
    }

    // Adjacence en mémoire pour détecter les cycles sans un aller-retour DB par arête —
    // l'IA est instruite de proposer un graphe acyclique mais rien ne le garantit.
    const existingEdges = await tx.prerequis.findMany({
      where: { notionId: { in: Array.from(notionIdByNom.values()) } },
      select: { notionId: true, prerequisNotionId: true },
    });
    const dependsOn = new Map<string, Set<string>>();
    for (const e of existingEdges) {
      if (!dependsOn.has(e.notionId)) dependsOn.set(e.notionId, new Set());
      dependsOn.get(e.notionId)!.add(e.prerequisNotionId);
    }
    const reaches = (from: string, to: string): boolean => {
      const visited = new Set<string>();
      const stack = [from];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === to) return true;
        if (visited.has(current)) continue;
        visited.add(current);
        for (const next of dependsOn.get(current) ?? []) stack.push(next);
      }
      return false;
    };

    let edgesCreated = 0;
    for (const edge of proposal.prerequisites) {
      const notionId = notionIdByNom.get(edge.notion);
      const prerequisNotionId = notionIdByNom.get(edge.prerequisDe);
      if (!notionId || !prerequisNotionId || notionId === prerequisNotionId) continue;
      if (dependsOn.get(notionId)?.has(prerequisNotionId)) continue; // déjà présente
      if (reaches(prerequisNotionId, notionId)) continue; // créerait un cycle

      await tx.prerequis.create({ data: { notionId, prerequisNotionId, statut: "PROPOSE_IA" } });
      if (!dependsOn.has(notionId)) dependsOn.set(notionId, new Set());
      dependsOn.get(notionId)!.add(prerequisNotionId);
      edgesCreated++;
    }

    return { notionsCount: notionIdByNom.size, edgesCreated };
  });
};

/** Toutes les arêtes proposées par l'IA, tous chapitres confondus — pour la file de validation. */
export const listAretesProposees = () =>
  prisma.prerequis.findMany({
    where: { statut: "PROPOSE_IA" },
    include: { notion: true, prerequisNotion: true },
  });

// ---- Fiches résumé (générées à la volée côté élève, relecture admin après coup) ----

export const listFichesResumeByNotion = async (notionId: string) => {
  const notion = await prisma.notion.findUnique({ where: { id: notionId } });
  if (!notion) throw new AppError("Notion introuvable", 404);
  return prisma.ficheResume.findMany({ where: { notionId }, orderBy: { createdAt: "desc" } });
};

/** Toutes les fiches résumé en attente de relecture, toutes notions confondues. */
export const listFichesResumeAValider = () =>
  prisma.ficheResume.findMany({
    where: { statut: "A_VALIDER" },
    include: { notion: true },
    orderBy: { createdAt: "desc" },
  });

export const updateFicheResume = async (id: string, data: { contenu?: string; statut?: "A_VALIDER" | "PUBLIE" }) => {
  const fiche = await prisma.ficheResume.findUnique({ where: { id } });
  if (!fiche) throw new AppError("Fiche résumé introuvable", 404);
  return prisma.ficheResume.update({ where: { id }, data });
};
