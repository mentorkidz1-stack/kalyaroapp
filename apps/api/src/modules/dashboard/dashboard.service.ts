import { prisma } from "../../db/prisma.js";

export const getDashboard = async () => {
  const [
    totalEleves,
    qcmAValider,
    saisieLibreAValider,
    fichesAValider,
    corrigesAValider,
    aretesProposees,
    totalCours,
    totalChapitres,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { in: ["ELEVE", "ETUDIANT"] } } }),
    prisma.questionQcm.count({ where: { statut: "A_VALIDER" } }),
    prisma.questionSaisieLibre.count({ where: { statut: "A_VALIDER" } }),
    prisma.ficheResume.count({ where: { statut: "A_VALIDER" } }),
    prisma.corrigeType.count({ where: { statutValidation: "A_VALIDER" } }),
    prisma.prerequis.count({ where: { statut: "PROPOSE_IA" } }),
    prisma.cours.count(),
    prisma.chapitre.count(),
  ]);

  const fragileGroups = await prisma.progressionNotion.groupBy({
    by: ["notionId"],
    where: { statut: "FRAGILE" },
    _count: { eleveId: true },
    orderBy: { _count: { eleveId: "desc" } },
    take: 10,
  });
  const notions = await prisma.notion.findMany({
    where: { id: { in: fragileGroups.map((g) => g.notionId) } },
  });
  const notionById = new Map(notions.map((n) => [n.id, n]));
  const notionsFragiles = fragileGroups.map((g) => ({
    notionId: g.notionId,
    nom: notionById.get(g.notionId)?.nom ?? "?",
    nbElevesFragiles: g._count.eleveId,
  }));

  return {
    totalEleves,
    totalCours,
    totalChapitres,
    contentAValider: qcmAValider + saisieLibreAValider + fichesAValider + corrigesAValider + aretesProposees,
    detailAValider: {
      qcm: qcmAValider,
      saisieLibre: saisieLibreAValider,
      fichesResume: fichesAValider,
      corriges: corrigesAValider,
      aretes: aretesProposees,
    },
    notionsFragiles,
  };
};
