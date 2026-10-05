import { beninDayKey, startOfBeninDay } from "../../lib/benin-day.js";

// Logique pure des révisions du jour (aucun accès base) : testable isolément et
// réutilisable plus tard côté client pour le mode hors ligne.

/** Nombre maximal de questions d'une séance de révisions, pour qu'elle reste terminable. */
export const DAILY_REVIEW_LIMIT = 15;
/** Une notion fragile mérite deux questions dans la séance, une notion maîtrisée une seule. */
const QUESTIONS_PAR_NOTION_FRAGILE = 2;
const QUESTIONS_PAR_NOTION_MAITRISEE = 1;
/** Temps moyen estimé par question QCM (lecture + réponse + correction). */
const SECONDES_PAR_QUESTION = 45;

/**
 * Date de la prochaine révision : minuit (heure du Bénin) `jours` jours plus tard. On
 * vise le début du jour plutôt que « maintenant + 24 h » : une notion ratée à 21 h doit
 * apparaître dès le lendemain matin, pas seulement le lendemain à 21 h.
 */
export function prochaineRevisionDans(now: Date, jours: number): Date {
  return startOfBeninDay(now, jours);
}

export interface NotionDue {
  notionId: string;
  statut: string;
  nbEchecsConsecutifs: number;
  /** Dernière erreur QCM de l'étudiant sur cette notion, si elle existe. */
  dernierEchecAt: Date | null;
  /** Nombre d'erreurs QCM récentes sur cette notion. */
  nbEchecsRecents: number;
  prochaineRevisionAt: Date;
  /** Erreur commise « sûr » pas encore rattrapée (chantier 3.1) : passe en tête. */
  erreurAssuree?: boolean;
}

/**
 * Erreurs commises en se déclarant sûr d'abord (les plus importantes à corriger), puis
 * erreurs les plus récentes (au jour près), puis les plus nombreuses, puis la
 * révision la plus en retard. Le tri au jour près laisse le nombre d'erreurs départager
 * deux notions ratées le même jour.
 */
export function trierNotionsDues<T extends NotionDue>(notions: T[]): T[] {
  return [...notions].sort((a, b) => {
    if (!!a.erreurAssuree !== !!b.erreurAssuree) return a.erreurAssuree ? -1 : 1;
    const jourA = a.dernierEchecAt ? beninDayKey(a.dernierEchecAt) : "";
    const jourB = b.dernierEchecAt ? beninDayKey(b.dernierEchecAt) : "";
    if (jourA !== jourB) return jourA < jourB ? 1 : -1;
    if (a.nbEchecsRecents !== b.nbEchecsRecents) return b.nbEchecsRecents - a.nbEchecsRecents;
    if (a.nbEchecsConsecutifs !== b.nbEchecsConsecutifs) return b.nbEchecsConsecutifs - a.nbEchecsConsecutifs;
    return a.prochaineRevisionAt.getTime() - b.prochaineRevisionAt.getTime();
  });
}

/**
 * Plan de la séance : liste ordonnée de notions (une entrée = une question QCM),
 * plafonnée à `limite`. On couvre d'abord un maximum de notions (une question chacune,
 * par ordre de priorité), puis on ajoute la deuxième question des notions fragiles.
 * Les questions sont ensuite mélangées, sans deux questions de suite sur la même notion
 * quand c'est possible.
 */
export function planifierSeance(
  notionsTriees: Pick<NotionDue, "notionId" | "statut">[],
  limite = DAILY_REVIEW_LIMIT,
  random: () => number = Math.random
): string[] {
  const retenues = notionsTriees.slice(0, limite);
  const plan = retenues.map((n) => n.notionId);
  for (const notion of retenues) {
    const quota = notion.statut === "FRAGILE" ? QUESTIONS_PAR_NOTION_FRAGILE : QUESTIONS_PAR_NOTION_MAITRISEE;
    for (let i = 1; i < quota && plan.length < limite; i++) plan.push(notion.notionId);
  }
  return melangerSansRepetition(plan, random);
}

function melangerSansRepetition(items: string[], random: () => number): string[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  // Réparation : si deux questions consécutives portent sur la même notion, on échange
  // la seconde avec une position où l'échange ne crée pas de nouvelle répétition.
  const repeteAutour = (k: number) => (k > 0 && a[k] === a[k - 1]) || (k < a.length - 1 && a[k] === a[k + 1]);
  for (let i = 1; i < a.length; i++) {
    if (a[i] !== a[i - 1]) continue;
    for (let j = 0; j < a.length; j++) {
      if (a[j] === a[i]) continue;
      [a[i], a[j]] = [a[j]!, a[i]!];
      if (!repeteAutour(i) && !repeteAutour(j)) break;
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
  }
  return a;
}

export function estimerDureeMinutes(nbQuestions: number): number {
  if (nbQuestions === 0) return 0;
  return Math.max(1, Math.ceil((nbQuestions * SECONDES_PAR_QUESTION) / 60));
}
