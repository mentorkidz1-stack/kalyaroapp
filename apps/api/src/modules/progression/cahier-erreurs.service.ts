import { classifyError, type ClassifyErrorInput } from "@kalyaro/ai-service";
import { prisma } from "../../db/prisma.js";
import { construireCahierErreurs, type ErreurEleve } from "./cahier-erreurs.js";

/** Le cahier porte sur les erreurs récentes : au-delà, elles ne disent plus grand-chose. */
const FENETRE_JOURS = 180;

/** Parcours (scolaire / universitaire) d'une notion, pour adapter le ton de l'IA. */
export async function parcoursDeNotion(notionId: string): Promise<ClassifyErrorInput["parcours"]> {
  const notion = await prisma.notion.findUnique({
    where: { id: notionId },
    select: { chapitre: { select: { cours: { select: { matiere: { select: { type: true } } } } } } },
  });
  return notion?.chapitre.cours.matiere.type ?? "SCOLAIRE";
}

/**
 * Classe la cause d'une erreur (IA) et l'enregistre sur la tentative. À appeler hors du
 * chemin de la réponse : l'élève n'attend pas ce classement pour voir son résultat.
 */
export async function classerErreur(tentativeId: string, entree: ClassifyErrorInput) {
  const { typeErreur, explication } = await classifyError(entree);
  await prisma.tentativeEleve.update({
    where: { id: tentativeId },
    data: { typeErreur, explicationErreur: explication },
  });
}

/** Version « tirer et oublier » : un échec laisse simplement l'erreur non classée. */
export function classerErreurEnArrierePlan(tentativeId: string, entree: () => Promise<ClassifyErrorInput>) {
  entree()
    .then((e) => classerErreur(tentativeId, e))
    .catch(() => undefined);
}

/**
 * Une réussite rattrape les erreurs antérieures sur la même question ou sa famille (question
 * d'origine et ses variantes) : elles passent « en voie de correction ».
 */
export async function marquerErreursCorrigees(
  eleveId: string,
  cible:
    | { questionQcmRacineId: string }
    | { questionSaisieLibreId: string }
    | { epreuveId: string; questionEpreuveId: string | null },
  now = new Date()
) {
  const ciblage =
    "questionQcmRacineId" in cible
      ? { questionQcm: { OR: [{ id: cible.questionQcmRacineId }, { varianteDeId: cible.questionQcmRacineId }] } }
      : "questionSaisieLibreId" in cible
        ? { questionSaisieLibreId: cible.questionSaisieLibreId }
        : { epreuveId: cible.epreuveId, questionEpreuveId: cible.questionEpreuveId };
  await prisma.tentativeEleve.updateMany({
    where: { eleveId, correcte: false, erreurCorrigeeAt: null, createdAt: { lt: now }, ...ciblage },
    data: { erreurCorrigeeAt: now },
  });
}

const notionSelect = { select: { id: true, nom: true, chapitreId: true } } as const;

export async function getCahierErreurs(eleveId: string, now = new Date()) {
  const depuis = new Date(now.getTime() - FENETRE_JOURS * 24 * 60 * 60 * 1000);
  const tentatives = await prisma.tentativeEleve.findMany({
    where: { eleveId, correcte: false, createdAt: { gte: depuis }, typeCible: { in: ["QCM", "SAISIE_LIBRE", "EPREUVE"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      typeCible: true,
      typeErreur: true,
      explicationErreur: true,
      erreurCorrigeeAt: true,
      questionQcm: { select: { enonce: true, notions: { select: { notion: notionSelect }, take: 1 } } },
      questionSaisieLibre: { select: { enonce: true, notions: { select: { notion: notionSelect }, take: 1 } } },
      questionEpreuve: { select: { numero: true, enonce: true, notion: notionSelect } },
      epreuve: { select: { enonce: true, notionPrincipale: notionSelect } },
    },
  });

  const erreurs: ErreurEleve[] = tentatives.map((t) => {
    const notion =
      t.questionQcm?.notions[0]?.notion ??
      t.questionSaisieLibre?.notions[0]?.notion ??
      t.questionEpreuve?.notion ??
      (t.questionEpreuve ? null : t.epreuve?.notionPrincipale) ??
      null;
    const enonce =
      t.questionQcm?.enonce ??
      t.questionSaisieLibre?.enonce ??
      (t.questionEpreuve ? `Question ${t.questionEpreuve.numero} : ${t.questionEpreuve.enonce}` : t.epreuve?.enonce) ??
      "";
    return {
      id: t.id,
      createdAt: t.createdAt,
      notionId: notion?.id ?? null,
      notionNom: notion?.nom ?? null,
      chapitreId: notion?.chapitreId ?? null,
      typeErreur: t.typeErreur,
      explication: t.explicationErreur,
      enonce,
      source: t.typeCible as ErreurEleve["source"],
      corrigee: t.erreurCorrigeeAt !== null,
    };
  });
  return construireCahierErreurs(erreurs);
}
