import { beninDayKey } from "../../lib/benin-day.js";
import { prochaineRevisionDans } from "./revisions.js";

// Moteur de maîtrise durable — fonction pure, sans accès base : testable isolément et
// réutilisable plus tard côté client (mode hors ligne).
//
// Niveaux : NON_VU → FRAGILE → ACQUIS_DU_JOUR → CONSOLIDE → DURABLE
//  - 3 réussites consécutives le même jour (heure du Bénin) → ACQUIS_DU_JOUR, révision à J+1.
//  - Réussite d'une révision due, au moins 1 jour après la précédente → CONSOLIDE, intervalle doublé.
//  - Réussite d'une révision due, au moins 7 jours après la précédente → DURABLE.
//  - Une réponse juste AVANT l'échéance de révision est un simple entraînement : elle ne fait
//    pas monter de niveau (sinon on mesurerait à nouveau la mémoire à court terme).
//  - Un échec fait redescendre d'UN niveau et remet l'intervalle à 1 jour.

export type NiveauMaitrise = "NON_VU" | "FRAGILE" | "ACQUIS_DU_JOUR" | "CONSOLIDE" | "DURABLE";

export const REUSSITES_POUR_ACQUIS = 3;
export const JOURS_MIN_POUR_CONSOLIDE = 1;
export const JOURS_MIN_POUR_DURABLE = 7;
export const INTERVALLE_INITIAL_JOURS = 1;
export const INTERVALLE_MAX_JOURS = 30;

const ORDRE: NiveauMaitrise[] = ["NON_VU", "FRAGILE", "ACQUIS_DU_JOUR", "CONSOLIDE", "DURABLE"];

export function rangNiveau(statut: NiveauMaitrise): number {
  return ORDRE.indexOf(statut);
}

/** Seuil de déblocage (saisie libre, notions dépendantes) : acquis au moins le jour même. */
export function estAcquise(statut: NiveauMaitrise | null | undefined): boolean {
  return rangNiveau(statut ?? "NON_VU") >= rangNiveau("ACQUIS_DU_JOUR");
}

export interface EtatProgression {
  statut: NiveauMaitrise;
  nbEchecsConsecutifs: number;
  nbSuccesConsecutifs: number;
  intervalleRevisionJours: number;
  /** Dernière montée de niveau validée (ou révision réussie) : référence des intervalles. */
  derniereRevisionAt: Date | null;
  prochaineRevisionAt: Date | null;
  /** Dernière réponse, quelle qu'elle soit : sert à savoir si une série a lieu « dans la journée ». */
  derniereTentativeAt: Date | null;
}

function joursEntre(a: Date, b: Date): number {
  const msParJour = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${beninDayKey(b)}T00:00:00Z`) - Date.parse(`${beninDayKey(a)}T00:00:00Z`)) / msParJour);
}

export function computeNextProgression(
  state: EtatProgression,
  { correcte, now }: { correcte: boolean; now: Date }
): EtatProgression {
  const memeJourQueDerniereTentative =
    state.derniereTentativeAt !== null && beninDayKey(state.derniereTentativeAt) === beninDayKey(now);
  const base = { ...state, derniereTentativeAt: now };

  if (!correcte) {
    const descendu: NiveauMaitrise =
      state.statut === "DURABLE" ? "CONSOLIDE" : state.statut === "CONSOLIDE" ? "ACQUIS_DU_JOUR" : "FRAGILE";
    return {
      ...base,
      statut: descendu,
      nbEchecsConsecutifs: state.nbEchecsConsecutifs + 1,
      nbSuccesConsecutifs: 0,
      intervalleRevisionJours: INTERVALLE_INITIAL_JOURS,
      // Pour un niveau conservé après descente, l'échec sert de nouveau point de départ :
      // la prochaine réussite à J+1 le reconsolidera.
      derniereRevisionAt: rangNiveau(descendu) >= rangNiveau("ACQUIS_DU_JOUR") ? now : state.derniereRevisionAt,
      prochaineRevisionAt: prochaineRevisionDans(now, INTERVALLE_INITIAL_JOURS),
    };
  }

  // Réussite sur une notion pas encore acquise : on compte la série du jour.
  if (!estAcquise(state.statut)) {
    const serie = (memeJourQueDerniereTentative ? state.nbSuccesConsecutifs : 0) + 1;
    const acquise = serie >= REUSSITES_POUR_ACQUIS;
    return {
      ...base,
      statut: acquise ? "ACQUIS_DU_JOUR" : "FRAGILE",
      nbEchecsConsecutifs: 0,
      nbSuccesConsecutifs: serie,
      intervalleRevisionJours: INTERVALLE_INITIAL_JOURS,
      derniereRevisionAt: acquise ? now : state.derniereRevisionAt,
      prochaineRevisionAt: prochaineRevisionDans(now, INTERVALLE_INITIAL_JOURS),
    };
  }

  const joursEcoules = state.derniereRevisionAt ? joursEntre(state.derniereRevisionAt, now) : 0;
  const revisionDue = state.prochaineRevisionAt !== null && now >= state.prochaineRevisionAt;

  // Entraînement avant l'échéance : aucun changement de niveau ni de calendrier.
  if (!revisionDue || joursEcoules < JOURS_MIN_POUR_CONSOLIDE) {
    return {
      ...base,
      nbEchecsConsecutifs: 0,
      nbSuccesConsecutifs: state.nbSuccesConsecutifs + 1,
    };
  }

  const statut: NiveauMaitrise =
    state.statut === "DURABLE" || joursEcoules >= JOURS_MIN_POUR_DURABLE ? "DURABLE" : "CONSOLIDE";
  const intervalle = Math.min(state.intervalleRevisionJours * 2, INTERVALLE_MAX_JOURS);
  return {
    ...base,
    statut,
    nbEchecsConsecutifs: 0,
    nbSuccesConsecutifs: state.nbSuccesConsecutifs + 1,
    intervalleRevisionJours: intervalle,
    derniereRevisionAt: now,
    prochaineRevisionAt: prochaineRevisionDans(now, intervalle),
  };
}
