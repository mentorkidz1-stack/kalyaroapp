import type { Epreuve, ModePassage, Notion, QuestionEpreuve, TypeParcours } from "@prisma/client";
import { gradeExamAnswer } from "@kalyaro/ai-service";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";
import { assertMatiereAccessible } from "../../lib/matiere-access.js";
import { recordDailyActivity } from "../../lib/streak.js";
import { startPrerequisiteDescent } from "../progression/progression.service.js";
import { arrondirPoints, calculerRapport, estRatee, type QuestionBareme } from "./notation.js";
import {
  DELAI_GRACE_MS,
  DUREE_EXAMEN_PAR_DEFAUT_MINUTES,
  analyserTemps,
  dateLimitePassage,
  deltaTempsValide,
  estExpire,
  notionsPrioritaires,
} from "./examen.js";

/** Clé de la question unique d'une épreuve non découpée (compatibilité ascendante). */
export const CLE_QUESTION_UNIQUE = "unique";
/** Barème par défaut d'une épreuve non découpée sans barème renseigné. */
const BAREME_PAR_DEFAUT = 20;
/** Corrections IA menées en parallèle lors de la correction groupée d'un examen blanc. */
const CORRECTIONS_SIMULTANEES = 3;
/** Au-delà, un verrou de correction est considéré comme abandonné (processus interrompu). */
const VERROU_CORRECTION_PERIME_MS = 5 * 60_000;

interface QuestionNotable {
  cle: string;
  questionEpreuveId: string | null;
  numero: string;
  enonce: string;
  points: number;
  notionId: string | null;
  notionNom: string | null;
  imageUrls: string[];
  corrigesValides: string[];
}

type EpreuveComplete = Epreuve & {
  notionPrincipale: Notion | null;
  corriges: { contenu: string; statutValidation: string; estPrincipal: boolean }[];
  questions: (QuestionEpreuve & {
    notion: Notion | null;
    corriges: { contenu: string; statutValidation: string; estPrincipal: boolean }[];
  })[];
  matiere: { type: TypeParcours };
};

const includeEpreuveComplete = {
  notionPrincipale: true,
  corriges: true,
  matiere: { select: { type: true } },
  questions: { include: { notion: true, corriges: true }, orderBy: { ordre: "asc" as const } },
};

const corrigesValides = (corriges: { contenu: string; statutValidation: string; estPrincipal: boolean }[]) =>
  corriges
    .filter((c) => c.statutValidation === "VALIDE")
    .sort((a, b) => Number(b.estPrincipal) - Number(a.estPrincipal))
    .map((c) => c.contenu);

/**
 * Questions notables d'une épreuve : ses questions découpées, ou — épreuve non découpée —
 * une question unique virtuelle (énoncé complet, notion principale, corrigés de l'épreuve).
 */
function questionsNotables(epreuve: EpreuveComplete): QuestionNotable[] {
  if (epreuve.questions.length > 0) {
    return epreuve.questions.map((q) => ({
      cle: q.id,
      questionEpreuveId: q.id,
      numero: q.numero,
      enonce: q.enonce,
      points: q.points,
      notionId: q.notionId,
      notionNom: q.notion?.nom ?? null,
      imageUrls: q.imageUrls,
      corrigesValides: corrigesValides(q.corriges),
    }));
  }
  return [
    {
      cle: CLE_QUESTION_UNIQUE,
      questionEpreuveId: null,
      numero: "1",
      enonce: epreuve.enonce,
      points: epreuve.bareme ?? BAREME_PAR_DEFAUT,
      notionId: epreuve.notionPrincipaleId,
      notionNom: epreuve.notionPrincipale?.nom ?? null,
      imageUrls: [],
      corrigesValides: corrigesValides(epreuve.corriges),
    },
  ];
}

/** Une épreuve n'est proposée que si chaque question a au moins un corrigé validé. */
const estNotable = (questions: QuestionNotable[]) => questions.every((q) => q.corrigesValides.length > 0);

const bareme = (epreuve: Epreuve, questions: QuestionNotable[]) =>
  epreuve.bareme ?? questions.reduce((s, q) => s + q.points, 0);

const dureeExamen = (epreuve: Epreuve) => epreuve.dureeMinutes ?? DUREE_EXAMEN_PAR_DEFAUT_MINUTES;

const metadonnees = (e: Epreuve) => ({
  annee: e.annee,
  session: e.session,
  examen: e.examen,
  etablissementSource: e.etablissementSource,
  dureeMinutes: e.dureeMinutes,
});

async function chargerEpreuve(epreuveId: string): Promise<EpreuveComplete> {
  const epreuve = await prisma.epreuve.findUnique({ where: { id: epreuveId }, include: includeEpreuveComplete });
  if (!epreuve) throw new AppError("Épreuve introuvable", 404);
  return epreuve;
}

// ---- Liste des épreuves d'une matière ----

export const listEpreuvesPourEtudiant = async (eleveId: string, matiereId: string) => {
  await assertMatiereAccessible(eleveId, matiereId);
  const epreuves = await prisma.epreuve.findMany({
    where: { matiereId },
    include: {
      ...includeEpreuveComplete,
      passages: {
        where: { eleveId, termineAt: { not: null }, pointsObtenus: { not: null } },
        orderBy: { termineAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ annee: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });

  return epreuves.flatMap((e) => {
    const questions = questionsNotables(e);
    if (!estNotable(questions)) return [];
    const dernier = e.passages[0];
    return [
      {
        id: e.id,
        enonce: e.enonce,
        ...metadonnees(e),
        dureeExamenMinutes: dureeExamen(e),
        bareme: bareme(e, questions),
        nbQuestions: questions.length,
        decoupee: e.questions.length > 0,
        dernierPassage: dernier
          ? {
              id: dernier.id,
              mode: dernier.mode,
              termineAt: dernier.termineAt,
              note: dernier.pointsObtenus,
              bareme: dernier.bareme,
            }
          : null,
      },
    ];
  });
};

// ---- Passage ----

async function chargerPassage(eleveId: string, passageId: string) {
  const passage = await prisma.passageEpreuve.findUnique({
    where: { id: passageId },
    include: { tentatives: { orderBy: { createdAt: "asc" } } },
  });
  if (!passage || passage.eleveId !== eleveId) throw new AppError("Passage introuvable", 404);
  const epreuve = await chargerEpreuve(passage.epreuveId);
  return { passage, epreuve, questions: questionsNotables(epreuve) };
}
type PassageCharge = Awaited<ReturnType<typeof chargerPassage>>;

const cleDeTentative = (t: { questionEpreuveId: string | null }) => t.questionEpreuveId ?? CLE_QUESTION_UNIQUE;
const brouillonsDe = (p: { brouillons: unknown }) => (p.brouillons ?? {}) as Record<string, string>;
const tempsDe = (p: { tempsParQuestion: unknown }) => (p.tempsParQuestion ?? {}) as Record<string, number>;

type EvaluationIaEpreuve = { explication: string; elementsReussis: string[]; elementsManquants: string[] };

function vuePassage({ passage, epreuve, questions }: PassageCharge) {
  const termine = passage.termineAt !== null;
  const examen = passage.mode === "EXAMEN_BLANC";
  const reponses = Object.fromEntries(
    passage.tentatives.map((t) => {
      const ia = (t.evaluationIa ?? {}) as Partial<EvaluationIaEpreuve>;
      return [
        cleDeTentative(t),
        {
          reponseDonnee: t.reponseDonnee,
          pointsObtenus: t.pointsObtenus ?? 0,
          pointsMax: t.pointsMax ?? 0,
          explication: ia.explication ?? "",
          elementsReussis: ia.elementsReussis ?? [],
          elementsManquants: ia.elementsManquants ?? [],
        },
      ];
    })
  );
  return {
    passageId: passage.id,
    mode: passage.mode,
    termine,
    epreuve: {
      id: epreuve.id,
      // Sujet complet : données communes à toutes les questions d'une épreuve découpée.
      enonce: epreuve.enonce,
      decoupee: epreuve.questions.length > 0,
      ...metadonnees(epreuve),
      bareme: bareme(epreuve, questions),
    },
    // Jamais les corrigés : ils restent côté serveur.
    questions: questions.map((q) => ({
      cle: q.cle,
      numero: q.numero,
      enonce: q.enonce,
      points: q.points,
      notionNom: q.notionNom,
      imageUrls: q.imageUrls,
    })),
    // En examen blanc, aucune correction n'est visible avant la fin (il n'en existe d'ailleurs pas).
    reponses: examen && !termine ? {} : reponses,
    examen: examen
      ? {
          dateLimiteAt: passage.dateLimiteAt,
          dureeMinutes: dureeExamen(epreuve),
          // Le client calcule le temps restant par rapport à l'heure du serveur, pas à la sienne.
          serverNow: new Date(),
          brouillons: brouillonsDe(passage),
        }
      : null,
  };
}

export const demarrerPassage = async (eleveId: string, epreuveId: string, mode: ModePassage = "ENTRAINEMENT") => {
  const epreuve = await chargerEpreuve(epreuveId);
  await assertMatiereAccessible(eleveId, epreuve.matiereId);
  if (!estNotable(questionsNotables(epreuve))) {
    throw new AppError("Cette épreuve n'a pas encore de corrigé validé pour chaque question", 400);
  }

  if (mode === "EXAMEN_BLANC") {
    // Revenir sur un examen en cours ne relance pas le chronomètre : on reprend le même.
    const enCours = await prisma.passageEpreuve.findFirst({
      where: { eleveId, epreuveId, mode: "EXAMEN_BLANC", termineAt: null },
      orderBy: { demarreAt: "desc" },
    });
    if (enCours && !estExpire(new Date(), enCours.dateLimiteAt, DELAI_GRACE_MS)) {
      return getPassage(eleveId, enCours.id);
    }
    if (enCours) await rendreExamen(eleveId, enCours.id);
  }

  const now = new Date();
  const passage = await prisma.passageEpreuve.create({
    data: {
      eleveId,
      epreuveId,
      mode,
      demarreAt: now,
      dateLimiteAt: mode === "EXAMEN_BLANC" ? dateLimitePassage(now, dureeExamen(epreuve)) : null,
    },
  });
  return vuePassage(await chargerPassage(eleveId, passage.id));
};

export const getPassage = async (eleveId: string, passageId: string) => {
  const charge = await chargerPassage(eleveId, passageId);
  const { passage } = charge;
  // Examen blanc abandonné après l'heure limite : la copie est rendue telle quelle.
  if (passage.mode === "EXAMEN_BLANC" && !passage.termineAt && estExpire(new Date(), passage.dateLimiteAt, DELAI_GRACE_MS)) {
    await rendreExamen(eleveId, passageId);
    return vuePassage(await chargerPassage(eleveId, passageId));
  }
  return vuePassage(charge);
};

/**
 * Note une réponse contre les corrigés validés (points partiels bornés par le serveur) et
 * l'enregistre. L'appel IA a lieu AVANT toute écriture : s'il échoue, rien n'est enregistré.
 */
async function noterEtEnregistrer(
  eleveId: string,
  passageId: string,
  epreuve: EpreuveComplete,
  question: QuestionNotable,
  reponseDonnee: string
) {
  const evaluation = await gradeExamAnswer({
    parcours: epreuve.matiere.type,
    contexteEpreuve: epreuve.questions.length > 0 ? epreuve.enonce : undefined,
    numero: question.numero,
    enonceQuestion: question.enonce,
    pointsMax: question.points,
    corriges: question.corrigesValides,
    reponseEtudiant: reponseDonnee,
  });
  const pointsObtenus = arrondirPoints(evaluation.pointsObtenus, question.points);
  const ratee = estRatee(pointsObtenus, question.points);
  const evaluationIa: EvaluationIaEpreuve = {
    explication: evaluation.explication,
    elementsReussis: evaluation.elementsReussis,
    elementsManquants: evaluation.elementsManquants,
  };
  const precedentes = await prisma.tentativeEleve.count({
    where: { eleveId, epreuveId: epreuve.id, questionEpreuveId: question.questionEpreuveId },
  });
  await prisma.tentativeEleve.create({
    data: {
      eleveId,
      typeCible: "EPREUVE",
      epreuveId: epreuve.id,
      questionEpreuveId: question.questionEpreuveId,
      passageId,
      reponseDonnee,
      correcte: !ratee,
      pointsObtenus,
      pointsMax: question.points,
      evaluationIa,
      tentativeNumero: precedentes + 1,
    },
  });
  return { pointsObtenus, ratee, evaluationIa };
}

/** Entraînement : correction immédiate, puis descente diagnostique si la question est ratée. */
export const repondreQuestion = async (eleveId: string, passageId: string, cle: string, reponseDonnee: string) => {
  const { passage, epreuve, questions } = await chargerPassage(eleveId, passageId);
  if (passage.mode === "EXAMEN_BLANC") {
    throw new AppError("En examen blanc, la correction n'a lieu qu'à la remise de la copie", 400);
  }
  if (passage.termineAt) throw new AppError("Ce passage est terminé", 400);
  const question = questions.find((q) => q.cle === cle);
  if (!question) throw new AppError("Question introuvable dans cette épreuve", 404);
  if (passage.tentatives.some((t) => cleDeTentative(t) === cle)) {
    throw new AppError("Tu as déjà répondu à cette question dans ce passage", 409);
  }

  const { pointsObtenus, ratee, evaluationIa } = await noterEtEnregistrer(eleveId, passageId, epreuve, question, reponseDonnee);
  await recordDailyActivity(eleveId);

  let diagnostic = null;
  if (question.notionId) {
    if (ratee) {
      // Enrichissement : un échec du diagnostic (IA indisponible…) ne doit pas faire perdre
      // la note, déjà enregistrée.
      try {
        diagnostic = await startPrerequisiteDescent(
          eleveId,
          epreuve.id,
          question.notionId,
          reponseDonnee,
          `Question ${question.numero} : ${question.enonce}`
        );
      } catch {
        diagnostic = null;
      }
    } else {
      await prisma.diagnosticPrerequis.updateMany({
        where: { eleveId, epreuveId: epreuve.id, notionDeclenchanteId: question.notionId, resolu: false },
        data: { resolu: true },
      });
    }
  }

  return { cle, pointsObtenus, pointsMax: question.points, ratee, ...evaluationIa, diagnostic };
};

// ---- Examen blanc ----

/**
 * Enregistrement automatique d'une réponse en cours et du temps passé sur la question.
 * Mise à jour JSON atomique en SQL : deux enregistrements simultanés (changement de question
 * + minuterie) ne s'écrasent pas.
 */
export const enregistrerBrouillon = async (
  eleveId: string,
  passageId: string,
  cle: string,
  texte: string,
  deltaSecondes: number
) => {
  const { passage, questions } = await chargerPassage(eleveId, passageId);
  if (passage.mode !== "EXAMEN_BLANC") throw new AppError("Brouillons réservés à l'examen blanc", 400);
  if (!questions.some((q) => q.cle === cle)) throw new AppError("Question introuvable dans cette épreuve", 404);
  if (passage.termineAt || estExpire(new Date(), passage.dateLimiteAt, DELAI_GRACE_MS)) {
    throw new AppError("Le temps est écoulé : ta copie a été rendue", 409);
  }
  const delta = deltaTempsValide(deltaSecondes);
  const modifies = await prisma.$executeRaw`
    UPDATE passages_epreuve
    SET brouillons = COALESCE(brouillons, '{}'::jsonb) || jsonb_build_object(${cle}::text, ${texte}::text),
        temps_par_question = COALESCE(temps_par_question, '{}'::jsonb)
          || jsonb_build_object(${cle}::text, COALESCE((temps_par_question ->> ${cle}::text)::float, 0) + ${delta}::float)
    WHERE id = ${passageId} AND termine_at IS NULL`;
  if (modifies === 0) throw new AppError("Le temps est écoulé : ta copie a été rendue", 409);
  return { enregistre: true };
};

async function parLots<T>(elements: T[], taille: number, traiter: (e: T) => Promise<void>) {
  for (let i = 0; i < elements.length; i += taille) {
    await Promise.all(elements.slice(i, i + taille).map(traiter));
  }
}

/** Les notions qui ont coûté le plus de points reviennent dès aujourd'hui dans les révisions. */
async function ajouterAuxRevisions(eleveId: string, notionIds: string[], now: Date) {
  for (const notionId of notionIds) {
    const existante = await prisma.progressionNotion.findUnique({ where: { eleveId_notionId: { eleveId, notionId } } });
    if (!existante) {
      await prisma.progressionNotion.create({ data: { eleveId, notionId, statut: "FRAGILE", prochaineRevisionAt: now } });
    } else if (!existante.prochaineRevisionAt || existante.prochaineRevisionAt > now) {
      await prisma.progressionNotion.update({
        where: { id: existante.id },
        data: { prochaineRevisionAt: now, ...(existante.statut === "NON_VU" ? { statut: "FRAGILE" as const } : {}) },
      });
    }
  }
}

/**
 * Remise d'une copie d'examen blanc (bouton « Rendre », fin du chronomètre, ou retour après
 * l'heure limite) : fige les réponses, corrige toutes les questions d'un coup, enregistre la
 * note et met en révision les notions prioritaires. Idempotent et protégé par un verrou :
 * deux remises simultanées ne corrigent pas deux fois la même question.
 */
export const rendreExamen = async (eleveId: string, passageId: string, brouillonsFinaux?: Record<string, string>) => {
  const initial = await chargerPassage(eleveId, passageId);
  if (initial.passage.mode !== "EXAMEN_BLANC") throw new AppError("Ce passage n'est pas un examen blanc", 400);

  const now = new Date();
  if (!initial.passage.termineAt) {
    // Le dernier état envoyé par le client n'est accepté que dans les temps.
    if (brouillonsFinaux && !estExpire(now, initial.passage.dateLimiteAt, DELAI_GRACE_MS)) {
      const cles = new Set(initial.questions.map((q) => q.cle));
      const valides = Object.fromEntries(Object.entries(brouillonsFinaux).filter(([cle]) => cles.has(cle)));
      await prisma.passageEpreuve.updateMany({
        where: { id: passageId, termineAt: null },
        data: { brouillons: { ...brouillonsDe(initial.passage), ...valides } },
      });
    }
    await prisma.passageEpreuve.updateMany({ where: { id: passageId, termineAt: null }, data: { termineAt: now } });
  }

  const verrou = await prisma.passageEpreuve.updateMany({
    where: {
      id: passageId,
      OR: [{ correctionDemarreeAt: null }, { correctionDemarreeAt: { lt: new Date(now.getTime() - VERROU_CORRECTION_PERIME_MS) } }],
    },
    data: { correctionDemarreeAt: now },
  });
  if (verrou.count === 1) {
    try {
      const { passage, epreuve, questions } = await chargerPassage(eleveId, passageId);
      const brouillons = brouillonsDe(passage);
      const corrigees = new Set(passage.tentatives.map(cleDeTentative));
      const aCorriger = questions.filter((q) => !corrigees.has(q.cle) && (brouillons[q.cle] ?? "").trim());
      await parLots(aCorriger, CORRECTIONS_SIMULTANEES, async (q) => {
        try {
          await noterEtEnregistrer(eleveId, passageId, epreuve, q, brouillons[q.cle]!.trim());
        } catch {
          // Question laissée non corrigée : « correctionIncomplete » dans le rapport, relançable.
        }
      });

      const apres = await chargerPassage(eleveId, passageId);
      const rapport = rapportDuPassage(apres);
      if (!rapport.correctionIncomplete && apres.passage.pointsObtenus === null) {
        await prisma.passageEpreuve.update({
          where: { id: passageId },
          data: { pointsObtenus: rapport.note, bareme: rapport.bareme },
        });
        await ajouterAuxRevisions(eleveId, rapport.notionsPrioritaires.map((n) => n.notionId), new Date());
        await recordDailyActivity(eleveId);
      }
    } finally {
      await prisma.passageEpreuve.update({ where: { id: passageId }, data: { correctionDemarreeAt: null } });
    }
  }
  return getRapport(eleveId, passageId);
};

// ---- Rapport ----

function rapportDuPassage({ passage, epreuve, questions }: PassageCharge) {
  const bareme_: QuestionBareme[] = questions.map((q) => ({
    cle: q.cle,
    numero: q.numero,
    points: q.points,
    notionId: q.notionId,
    notionNom: q.notionNom,
  }));
  const reponses = passage.tentatives.map((t) => ({ cle: cleDeTentative(t), pointsObtenus: t.pointsObtenus ?? 0 }));
  const rapport = calculerRapport(bareme_, reponses, epreuve.bareme);

  if (passage.mode !== "EXAMEN_BLANC") {
    return { ...rapport, mode: passage.mode, correctionIncomplete: false, temps: null, notionsPrioritaires: [] };
  }
  const brouillons = brouillonsDe(passage);
  const corrigees = new Set(passage.tentatives.map(cleDeTentative));
  return {
    ...rapport,
    mode: passage.mode,
    // Une réponse rédigée mais pas encore corrigée (IA indisponible au moment de la remise).
    correctionIncomplete: questions.some((q) => (brouillons[q.cle] ?? "").trim() && !corrigees.has(q.cle)),
    temps: analyserTemps(questions, tempsDe(passage), dureeExamen(epreuve)),
    notionsPrioritaires: notionsPrioritaires(rapport.parNotion),
  };
}

export const terminerPassage = async (eleveId: string, passageId: string) => {
  const charge = await chargerPassage(eleveId, passageId);
  if (charge.passage.mode === "EXAMEN_BLANC") return rendreExamen(eleveId, passageId);
  const rapport = rapportDuPassage(charge);
  if (!charge.passage.termineAt) {
    await prisma.passageEpreuve.update({
      where: { id: passageId },
      data: { termineAt: new Date(), pointsObtenus: rapport.note, bareme: rapport.bareme },
    });
  }
  return { termine: true, ...rapport };
};

export const getRapport = async (eleveId: string, passageId: string) => {
  const charge = await chargerPassage(eleveId, passageId);
  return { termine: charge.passage.termineAt !== null, ...rapportDuPassage(charge) };
};
