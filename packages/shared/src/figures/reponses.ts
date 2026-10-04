import { z } from "zod";

// Réponses données SUR une figure (chantier 2.4) : placer un point dans un repère, lire une
// valeur sur une courbe. Correction automatique, sans IA : fonctions pures partagées entre
// l'API et l'application (réutilisables pour un futur mode hors ligne).

export const TYPES_REPONSE = ["CHOIX", "PLACER_POINT", "LIRE_VALEUR"] as const;
export type TypeReponse = (typeof TYPES_REPONSE)[number];

const nombre = z.number().finite();

export const reponseAttendueSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PLACER_POINT"),
    x: nombre,
    y: nombre,
    /** Écart toléré sur chaque coordonnée, dans les unités du repère (ex. 0,25). */
    tolerance: z.number().positive().max(1000),
    /** Pas de la grille sur laquelle le point posé « s'aimante » (facultatif). */
    pasGrille: z.number().positive().max(1000).optional(),
  }),
  z.object({
    type: z.literal("LIRE_VALEUR"),
    valeur: nombre,
    /** Écart toléré (lecture graphique approximative), ex. 0,2. */
    tolerance: z.number().min(0).max(1e6),
    unite: z.string().trim().max(30).optional(),
  }),
]);
export type ReponseAttendue = z.infer<typeof reponseAttendueSchema>;

/** Nombre saisi par un étudiant : « 2,5 », « −3 », « +4 », « 1/2 », « 3 cm ». null si illisible. */
export function lireNombre(saisie: string): number | null {
  const s = saisie
    .trim()
    .replace(/[−–]/g, "-")
    .replace(",", ".")
    .replace(/\s+/g, "")
    .replace(/[a-zA-Zµ°%€$]+$/, ""); // unité éventuelle en fin de saisie
  const fraction = /^([+-]?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s);
  if (fraction) {
    const d = Number(fraction[2]);
    return d === 0 ? null : Number(fraction[1]) / d;
  }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return Number(s);
}

/** Point posé sur la grille la plus proche (aide au toucher sur téléphone). */
export function aimanter(valeur: number, pas: number | undefined): number {
  if (!pas) return valeur;
  return Number((Math.round(valeur / pas) * pas).toPrecision(12));
}

/** Encodage de la réponse « placer un point » envoyée à l'API : "x;y". */
export const encoderPoint = (x: number, y: number) => `${x};${y}`;
export function decoderPoint(reponse: string): [number, number] | null {
  const m = /^\s*(-?\d+(?:\.\d+)?(?:e-?\d+)?)\s*;\s*(-?\d+(?:\.\d+)?(?:e-?\d+)?)\s*$/.exec(reponse);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const EPSILON = 1e-9;

/** Correction d'une réponse sur figure. La tolérance s'applique coordonnée par coordonnée. */
export function corrigerReponseFigure(attendue: ReponseAttendue, reponse: string): boolean {
  if (attendue.type === "PLACER_POINT") {
    const p = decoderPoint(reponse);
    if (!p) return false;
    return Math.abs(p[0] - attendue.x) <= attendue.tolerance + EPSILON && Math.abs(p[1] - attendue.y) <= attendue.tolerance + EPSILON;
  }
  const v = lireNombre(reponse);
  return v !== null && Math.abs(v - attendue.valeur) <= attendue.tolerance + EPSILON;
}

/**
 * Cohérence d'une question à réponse sur figure : bonne réponse attendue du bon type, figure
 * présente et adaptée (un point se place dans un repère, à l'intérieur de sa fenêtre).
 * Renvoie la liste des erreurs (vide si tout va bien).
 */
export function verifierQuestionSurFigure(typeReponse: TypeReponse, figure: unknown, attendue: unknown): string[] {
  if (typeReponse === "CHOIX") return [];
  const erreurs: string[] = [];
  const r = reponseAttendueSchema.safeParse(attendue);
  if (!r.success) return ["Réponse attendue manquante ou invalide (valeur, tolérance…)"];
  if (r.data.type !== typeReponse) erreurs.push(`La réponse attendue doit être de type ${typeReponse}`);
  const f = figure as { type?: string; xMin?: number; xMax?: number; yMin?: number; yMax?: number } | null | undefined;
  if (!f || typeof f !== "object") return [...erreurs, "Une figure est obligatoire pour répondre sur la figure"];
  if (typeReponse === "PLACER_POINT") {
    if (f.type !== "repere") erreurs.push("Placer un point demande une figure de type repère");
    else if (r.data.type === "PLACER_POINT") {
      const { x, y } = r.data;
      if (x < f.xMin! || x > f.xMax! || y < f.yMin! || y > f.yMax!) erreurs.push("Le point attendu est hors de la fenêtre du repère");
    }
  }
  return erreurs;
}

const fr = (v: number) => Number(v.toPrecision(10)).toLocaleString("fr-FR", { maximumFractionDigits: 4 }).replace("-", "−");

/** Bonne réponse lisible, affichée après correction : « (2 ; 3) », « 2,5 cm ». */
export function libelleReponseAttendue(attendue: ReponseAttendue): string {
  if (attendue.type === "PLACER_POINT") return `(${fr(attendue.x)} ; ${fr(attendue.y)})`;
  return `${fr(attendue.valeur)}${attendue.unite ? ` ${attendue.unite}` : ""}`;
}

/** Réponse de l'étudiant, lisible : « (1,5 ; 2) », « 2,4 ». */
export function libelleReponseDonnee(type: TypeReponse, reponse: string): string {
  if (type === "PLACER_POINT") {
    const p = decoderPoint(reponse);
    return p ? `(${fr(p[0])} ; ${fr(p[1])})` : reponse;
  }
  return reponse;
}
