import { prisma } from "../../db/prisma.js";

/** En dessous, un étudiant qui rate une question risque de retomber sur la même. */
export const MIN_QUESTIONS_PUBLIEES_PAR_NOTION = 3;

/** Notions qui manquent de questions publiées (variantes comprises), les plus pauvres d'abord. */
async function getNotionsAQuestionsInsuffisantes() {
  const notions = await prisma.notion.findMany({
    select: {
      id: true,
      nom: true,
      chapitre: { select: { id: true, titre: true } },
      _count: { select: { questionsQcm: { where: { questionQcm: { statut: "PUBLIE" } } } } },
    },
  });
  return notions
    .filter((n) => n._count.questionsQcm < MIN_QUESTIONS_PUBLIEES_PAR_NOTION)
    .sort((a, b) => a._count.questionsQcm - b._count.questionsQcm || a.nom.localeCompare(b.nom))
    .map((n) => ({
      notionId: n.id,
      nom: n.nom,
      chapitreId: n.chapitre.id,
      chapitreTitre: n.chapitre.titre,
      nbQuestionsPubliees: n._count.questionsQcm,
    }));
}

export const getDashboard = async () => {
  const [
    totalEleves,
    qcmAValider,
    saisieLibreAValider,
    fichesAValider,
    corrigesAValider,
    corrigesQuestionsAValider,
    aretesProposees,
    totalCours,
    totalChapitres,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { in: ["ELEVE", "ETUDIANT"] } } }),
    prisma.questionQcm.count({ where: { statut: "A_VALIDER" } }),
    prisma.questionSaisieLibre.count({ where: { statut: "A_VALIDER" } }),
    prisma.ficheResume.count({ where: { statut: "A_VALIDER" } }),
    prisma.corrigeType.count({ where: { statutValidation: "A_VALIDER" } }),
    prisma.corrigeQuestionEpreuve.count({ where: { statutValidation: "A_VALIDER" } }),
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

  const notionsAQuestionsInsuffisantes = await getNotionsAQuestionsInsuffisantes();

  return {
    totalEleves,
    totalCours,
    totalChapitres,
    contentAValider:
      qcmAValider + saisieLibreAValider + fichesAValider + corrigesAValider + corrigesQuestionsAValider + aretesProposees,
    detailAValider: {
      qcm: qcmAValider,
      saisieLibre: saisieLibreAValider,
      fichesResume: fichesAValider,
      corriges: corrigesAValider + corrigesQuestionsAValider,
      aretes: aretesProposees,
    },
    notionsFragiles,
    minQuestionsParNotion: MIN_QUESTIONS_PUBLIEES_PAR_NOTION,
    notionsAQuestionsInsuffisantes,
  };
};
