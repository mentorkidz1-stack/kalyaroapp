// Examen blanc (chantier 2.2) — fonctions pures : chronomètre, temps par question, priorités.

/** Durée d'un examen blanc si l'épreuve n'en indique pas. */
export const DUREE_EXAMEN_PAR_DEFAUT_MINUTES = 60;
/** Marge accordée après l'heure limite pour absorber la latence réseau du dernier envoi. */
export const DELAI_GRACE_MS = 30_000;
/** Un enregistrement automatique ne peut pas créditer plus de temps que ça sur une question
 * (le client enregistre au moins toutes les 30 s) : borne les valeurs aberrantes ou forgées. */
export const TEMPS_MAX_PAR_ENREGISTREMENT_S = 120;
/** Nombre de notions mises en révision immédiate à l'issue d'un examen blanc. */
export const NB_NOTIONS_PRIORITAIRES = 3;

/** Copie papier : temps laissé après l'heure limite pour photographier les pages (on n'écrit
 * plus, on photographie — l'examen blanc reste un entraînement personnel). */
export const DELAI_PHOTOS_MS = 10 * 60_000;
/** Nombre maximal de pages photographiées pour une copie d'examen blanc. */
export const MAX_PAGES_COPIE = 8;

/** Fin effective d'un examen blanc : heure limite + marge réseau, ou + délai photo si copie papier. */
export function finExamen(passage: { dateLimiteAt: Date | null; copiePapier: boolean }): Date | null {
  if (!passage.dateLimiteAt) return null;
  return new Date(passage.dateLimiteAt.getTime() + (passage.copiePapier ? DELAI_PHOTOS_MS : DELAI_GRACE_MS));
}

/** Ajoute de nouvelles transcriptions (nouvelles pages) à celles déjà lues, question par question. */
export function fusionnerTranscriptions(
  existantes: Record<string, string>,
  nouvelles: { cle: string; texte: string }[]
): Record<string, string> {
  const resultat = { ...existantes };
  for (const { cle, texte } of nouvelles) {
    const t = texte.trim();
    if (!t) continue;
    resultat[cle] = resultat[cle] ? `${resultat[cle]}\n${t}` : t;
  }
  return resultat;
}

/** Réponse corrigée pour une question : le texte tapé et/ou ce qui a été lu sur les photos. */
export function reponseFinale(tapee: string | undefined, transcrite: string | undefined): { texte: string; depuisPhoto: boolean } {
  const a = (tapee ?? "").trim();
  const b = (transcrite ?? "").trim();
  if (a && b) return { texte: `${a}\n\n${b}`, depuisPhoto: true };
  return { texte: a || b, depuisPhoto: !a && !!b };
}

export function dateLimitePassage(demarreAt: Date, dureeMinutes: number | null): Date {
  return new Date(demarreAt.getTime() + (dureeMinutes ?? DUREE_EXAMEN_PAR_DEFAUT_MINUTES) * 60_000);
}

export function estExpire(now: Date, dateLimite: Date | null, graceMs = 0): boolean {
  return dateLimite !== null && now.getTime() > dateLimite.getTime() + graceMs;
}

/** Temps crédité pour un enregistrement : jamais négatif, jamais au-delà du plafond. */
export function deltaTempsValide(deltaSecondes: number): number {
  if (!Number.isFinite(deltaSecondes) || deltaSecondes <= 0) return 0;
  return Math.min(Math.round(deltaSecondes), TEMPS_MAX_PAR_ENREGISTREMENT_S);
}

export type StatutTemps = "non_abordee" | "rapide" | "dans_le_temps" | "trop_long";

export interface AnalyseTemps {
  dureeSecondes: number;
  tempsTotalSecondes: number;
  parQuestion: {
    cle: string;
    numero: string;
    tempsSecondes: number;
    /** Temps conseillé : la durée de l'épreuve répartie au prorata des points. */
    tempsConseilleSecondes: number;
    statut: StatutTemps;
  }[];
}

/**
 * Compare le temps passé sur chaque question au temps conseillé. « trop_long » au-delà de
 * 1,5 × le temps conseillé, « rapide » en dessous de la moitié.
 */
export function analyserTemps(
  questions: { cle: string; numero: string; points: number }[],
  temps: Record<string, number>,
  dureeMinutes: number
): AnalyseTemps {
  const dureeSecondes = dureeMinutes * 60;
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const parQuestion = questions.map((q) => {
    const tempsSecondes = Math.max(0, Math.round(temps[q.cle] ?? 0));
    const tempsConseilleSecondes = totalPoints > 0 ? Math.round((dureeSecondes * q.points) / totalPoints) : 0;
    const statut: StatutTemps =
      tempsSecondes === 0
        ? "non_abordee"
        : tempsSecondes > tempsConseilleSecondes * 1.5
          ? "trop_long"
          : tempsSecondes < tempsConseilleSecondes * 0.5
            ? "rapide"
            : "dans_le_temps";
    return { cle: q.cle, numero: q.numero, tempsSecondes, tempsConseilleSecondes, statut };
  });
  return {
    dureeSecondes,
    tempsTotalSecondes: parQuestion.reduce((s, q) => s + q.tempsSecondes, 0),
    parQuestion,
  };
}

/** Les notions qui ont coûté le plus de points (rattachées à une notion, au moins un point perdu). */
export function notionsPrioritaires<T extends { notionId: string | null; pointsPerdus: number }>(
  parNotion: T[],
  nombre = NB_NOTIONS_PRIORITAIRES
): (T & { notionId: string })[] {
  return [...parNotion]
    .filter((n): n is T & { notionId: string } => n.notionId !== null && n.pointsPerdus > 0)
    .sort((a, b) => b.pointsPerdus - a.pointsPerdus)
    .slice(0, nombre);
}
