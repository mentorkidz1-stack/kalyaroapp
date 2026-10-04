import { z } from "zod";
import { compilerExpression } from "./expression.js";

// Description structurée d'une figure mathématique. L'IA (ou un admin) produit ce JSON ;
// l'application dessine elle-même la figure, exactement. Toute incohérence (borne inversée,
// expression mal formée, point inconnu, tailles de tableaux différentes…) fait échouer la
// validation : une figure invalide est refusée, jamais dessinée de travers.

const nombre = z.number().finite();
const texteCourt = z.string().trim().min(1).max(40);
const expression = z
  .string()
  .max(200)
  .superRefine((e, ctx) => {
    const r = compilerExpression(e);
    if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Expression « ${e} » : ${r.erreur}` });
  });
const couple = z.tuple([nombre, nombre]);

// ---------------------------------------------------------------- 1. Repère
const elementRepere = z.discriminatedUnion("type", [
  z.object({ type: z.literal("point"), x: nombre, y: nombre, nom: texteCourt.optional() }),
  /** Droite y = a·x + b */
  z.object({ type: z.literal("droite"), a: nombre, b: nombre, nom: texteCourt.optional() }),
  z.object({ type: z.literal("verticale"), x: nombre, nom: texteCourt.optional() }),
  z.object({
    type: z.literal("courbe"),
    expression,
    xMin: nombre.optional(),
    xMax: nombre.optional(),
    nom: texteCourt.optional(),
  }),
  z.object({ type: z.literal("segment"), de: couple, a: couple, nom: texteCourt.optional() }),
  z.object({ type: z.literal("vecteur"), de: couple, a: couple, nom: texteCourt.optional() }),
  /** Zone hachurée entre deux courbes (ou entre une courbe et l'axe des abscisses). */
  z.object({
    type: z.literal("zone"),
    haut: expression,
    bas: expression.optional(),
    xMin: nombre,
    xMax: nombre,
    nom: texteCourt.optional(),
  }),
]);

export const repereSchema = z
  .object({
    type: z.literal("repere"),
    xMin: nombre,
    xMax: nombre,
    yMin: nombre,
    yMax: nombre,
    /** Pas des graduations (sinon choisi automatiquement). */
    pasX: z.number().positive().optional(),
    pasY: z.number().positive().optional(),
    grille: z.boolean().optional(),
    legendeX: texteCourt.optional(),
    legendeY: texteCourt.optional(),
    elements: z.array(elementRepere).max(30),
  })
  .superRefine((r, ctx) => {
    if (r.xMin >= r.xMax) ctx.addIssue({ code: "custom", message: "xMin doit être inférieur à xMax", path: ["xMax"] });
    if (r.yMin >= r.yMax) ctx.addIssue({ code: "custom", message: "yMin doit être inférieur à yMax", path: ["yMax"] });
    if (r.xMax - r.xMin > 1e6 || r.yMax - r.yMin > 1e6) ctx.addIssue({ code: "custom", message: "Fenêtre trop grande" });
    const n = (pas: number | undefined, etendue: number) => (pas ? etendue / pas : 0);
    if (n(r.pasX, r.xMax - r.xMin) > 60 || n(r.pasY, r.yMax - r.yMin) > 60) {
      ctx.addIssue({ code: "custom", message: "Graduations trop serrées (60 au plus par axe)" });
    }
    r.elements.forEach((e, i) => {
      if ((e.type === "courbe" || e.type === "zone") && e.xMin !== undefined && e.xMax !== undefined && e.xMin >= e.xMax) {
        ctx.addIssue({ code: "custom", message: "Intervalle de tracé inversé", path: ["elements", i] });
      }
    });
  });

// ---------------------------------------------------------------- 2. Tableaux de variations et de signes
const signe = z.enum(["+", "-"]);
/** Ce qui s'écrit SOUS une valeur de x : rien, un zéro, ou une double barre (valeur interdite). */
const marque = z.enum(["", "0", "||"]);

const ligneSignes = z.object({
  /** Libellé de la ligne : « x − 2 », « f'(x) »… */
  libelle: texteCourt,
  /** Un signe par intervalle (entre deux valeurs de x consécutives). */
  signes: z.array(signe),
  /** Une marque par valeur de x. */
  marques: z.array(marque),
});

function verifierLigne(ligne: z.infer<typeof ligneSignes>, nbX: number, ctx: z.RefinementCtx, path: (string | number)[]) {
  if (ligne.signes.length !== nbX - 1) {
    ctx.addIssue({ code: "custom", message: `« ${ligne.libelle} » : il faut ${nbX - 1} signe(s), un par intervalle`, path });
  }
  if (ligne.marques.length !== nbX) {
    ctx.addIssue({ code: "custom", message: `« ${ligne.libelle} » : il faut ${nbX} marque(s), une par valeur de x`, path });
  }
}

export const tableauSignesSchema = z
  .object({
    type: z.literal("tableau_signes"),
    variable: z.string().trim().min(1).max(4).default("x"),
    /** Valeurs de x en texte, dans l'ordre : « −∞ », « −3 », « 1/2 », « +∞ ». */
    valeursX: z.array(texteCourt).min(2).max(8),
    lignes: z.array(ligneSignes).min(1).max(6),
  })
  .superRefine((t, ctx) => t.lignes.forEach((l, i) => verifierLigne(l, t.valeursX.length, ctx, ["lignes", i])));

export const tableauVariationsSchema = z
  .object({
    type: z.literal("tableau_variations"),
    variable: z.string().trim().min(1).max(4).default("x"),
    fonction: z.string().trim().min(1).max(10).default("f"),
    valeursX: z.array(texteCourt).min(2).max(8),
    /** Ligne du signe de la dérivée (facultative). */
    derivee: ligneSignes.optional(),
    /** Sens de variation sur chaque intervalle. */
    variations: z.array(z.enum(["croissante", "decroissante", "constante"])),
    /** Valeur de la fonction à chaque valeur de x (« » si non demandée, « || » si interdite). */
    valeurs: z.array(z.string().max(40)),
  })
  .superRefine((t, ctx) => {
    const n = t.valeursX.length;
    if (t.variations.length !== n - 1) ctx.addIssue({ code: "custom", message: `Il faut ${n - 1} sens de variation`, path: ["variations"] });
    if (t.valeurs.length !== n) ctx.addIssue({ code: "custom", message: `Il faut ${n} valeur(s) de la fonction`, path: ["valeurs"] });
    if (t.derivee) {
      verifierLigne(t.derivee, n, ctx, ["derivee"]);
      // Cohérence signe de la dérivée ↔ variations (le cœur de l'exercice : jamais contradictoire).
      t.derivee.signes.forEach((s, i) => {
        const v = t.variations[i];
        if (v && v !== "constante" && (s === "+") !== (v === "croissante")) {
          ctx.addIssue({ code: "custom", message: `Intervalle ${i + 1} : signe ${s} incompatible avec « ${v} »`, path: ["variations", i] });
        }
      });
    }
  });

// ---------------------------------------------------------------- 3. Diagrammes statistiques
const diagrammeCommun = { type: z.literal("diagramme_statistique"), titre: texteCourt.optional(), legendeX: texteCourt.optional(), legendeY: texteCourt.optional() };

export const diagrammeStatistiqueSchema = z
  .discriminatedUnion("sousType", [
    z.object({
      ...diagrammeCommun,
      sousType: z.literal("barres"),
      categories: z.array(texteCourt).min(1).max(15),
      valeurs: z.array(z.number().finite().min(0)),
    }),
    z.object({
      ...diagrammeCommun,
      sousType: z.literal("histogramme"),
      /** Classes contiguës [min ; max[ et leur effectif (l'aire de chaque rectangle est proportionnelle à l'effectif). */
      classes: z.array(z.object({ min: nombre, max: nombre, effectif: z.number().finite().min(0) })).min(1).max(15),
    }),
    z.object({
      ...diagrammeCommun,
      sousType: z.literal("boite_moustaches"),
      min: nombre,
      q1: nombre,
      mediane: nombre,
      q3: nombre,
      max: nombre,
    }),
    z.object({
      ...diagrammeCommun,
      sousType: z.literal("nuage_points"),
      points: z.array(couple).min(1).max(200),
      /** Droite d'ajustement y = a·x + b (facultative). */
      ajustement: z.object({ a: nombre, b: nombre }).optional(),
    }),
  ])
  .superRefine((d, ctx) => {
    if (d.sousType === "barres" && d.valeurs.length !== d.categories.length) {
      ctx.addIssue({ code: "custom", message: "Autant de valeurs que de catégories", path: ["valeurs"] });
    }
    if (d.sousType === "histogramme") {
      d.classes.forEach((c, i) => {
        if (c.min >= c.max) ctx.addIssue({ code: "custom", message: `Classe ${i + 1} : min ≥ max`, path: ["classes", i] });
        const suivante = d.classes[i + 1];
        if (suivante && Math.abs(suivante.min - c.max) > 1e-9) {
          ctx.addIssue({ code: "custom", message: `Classes ${i + 1} et ${i + 2} non contiguës`, path: ["classes", i + 1] });
        }
      });
    }
    if (d.sousType === "boite_moustaches" && !(d.min <= d.q1 && d.q1 <= d.mediane && d.mediane <= d.q3 && d.q3 <= d.max)) {
      ctx.addIssue({ code: "custom", message: "Il faut min ≤ Q1 ≤ médiane ≤ Q3 ≤ max" });
    }
  });

// ---------------------------------------------------------------- 4. Arbre de probabilités
export interface BrancheArbre {
  evenement: string;
  /** Probabilité en texte : « 0,3 », « 1/4 », « p », « 1 − p ». */
  probabilite: string;
  enfants?: BrancheArbre[];
}
const branche: z.ZodType<BrancheArbre> = z.lazy(() =>
  z.object({
    evenement: z.string().trim().min(1).max(20),
    probabilite: z.string().trim().min(1).max(20),
    enfants: z.array(branche).min(1).max(4).optional(),
  })
);

/** Valeur numérique d'une probabilité écrite « 0,3 », « .25 » ou « 1/4 » ; null si symbolique (p, 1 − p). */
export function valeurProbabilite(p: string): number | null {
  const s = p.replace(",", ".").replace(/\s/g, "");
  const fraction = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return /^\d*\.?\d+$/.test(s) ? Number(s) : null;
}

function profondeur(b: BrancheArbre[]): number {
  return 1 + Math.max(0, ...b.map((x) => (x.enfants ? profondeur(x.enfants) : 0)));
}

export const arbreProbabilitesSchema = z
  .object({ type: z.literal("arbre_probabilites"), branches: z.array(branche).min(2).max(4) })
  .superRefine((a, ctx) => {
    if (profondeur(a.branches) > 3) ctx.addIssue({ code: "custom", message: "Trois niveaux au plus" });
    const verifier = (freres: BrancheArbre[], chemin: string) => {
      const valeurs = freres.map((f) => valeurProbabilite(f.probabilite));
      if (valeurs.some((v) => v !== null && (v < 0 || v > 1))) {
        ctx.addIssue({ code: "custom", message: `${chemin} : une probabilité doit être entre 0 et 1` });
      }
      // On ne contrôle la somme que si toutes les probabilités du nœud sont numériques.
      if (valeurs.every((v) => v !== null)) {
        const somme = (valeurs as number[]).reduce((s, v) => s + v, 0);
        if (Math.abs(somme - 1) > 0.005) {
          ctx.addIssue({ code: "custom", message: `${chemin} : les probabilités somment à ${Math.round(somme * 1000) / 1000}, pas à 1` });
        }
      }
      freres.forEach((f) => f.enfants && verifier(f.enfants, `${chemin} › ${f.evenement}`));
    };
    verifier(a.branches, "Racine");
  });

// ---------------------------------------------------------------- 5. Géométrie plane
const nomPoint = z.string().trim().regex(/^[A-Z][0-9']{0,2}$/, "Nom de point : une majuscule (A, B', M1…)");

export const geometriePlaneSchema = z
  .object({
    type: z.literal("geometrie_plane"),
    points: z.array(z.object({ nom: nomPoint, x: nombre, y: nombre, cache: z.boolean().optional() })).min(1).max(26),
    segments: z
      .array(
        z.object({
          de: nomPoint,
          a: nomPoint,
          /** Longueur affichée : « 5 cm », « x », « ? ». */
          longueur: z.string().trim().max(15).optional(),
          /** Codage de longueurs égales : 1 à 3 petits traits. */
          codage: z.number().int().min(1).max(3).optional(),
          /** Codage de droites parallèles : 1 ou 2 chevrons (mêmes chevrons = parallèles). */
          parallele: z.number().int().min(1).max(2).optional(),
          pointille: z.boolean().optional(),
        })
      )
      .max(30)
      .default([]),
    /** Droites (prolongées) passant par deux points. */
    droites: z.array(z.object({ par: z.tuple([nomPoint, nomPoint]), nom: z.string().trim().max(6).optional() })).max(10).default([]),
    cercles: z.array(z.object({ centre: nomPoint, rayon: z.number().positive() })).max(5).default([]),
    angles: z
      .array(
        z.object({
          /** Angle de sommet `sommet`, entre les demi-droites vers `de` et vers `a`. */
          sommet: nomPoint,
          de: nomPoint,
          a: nomPoint,
          droit: z.boolean().optional(),
          valeur: z.string().trim().max(10).optional(),
        })
      )
      .max(10)
      .default([]),
  })
  .superRefine((g, ctx) => {
    const noms = new Set<string>();
    g.points.forEach((p, i) => {
      if (noms.has(p.nom)) ctx.addIssue({ code: "custom", message: `Point ${p.nom} défini deux fois`, path: ["points", i] });
      noms.add(p.nom);
    });
    const existe = (nom: string, path: (string | number)[]) => {
      if (!noms.has(nom)) ctx.addIssue({ code: "custom", message: `Point ${nom} non défini`, path });
    };
    g.segments.forEach((s, i) => {
      existe(s.de, ["segments", i]);
      existe(s.a, ["segments", i]);
    });
    g.droites.forEach((d, i) => d.par.forEach((n) => existe(n, ["droites", i])));
    g.cercles.forEach((c, i) => existe(c.centre, ["cercles", i]));
    g.angles.forEach((a, i) => [a.sommet, a.de, a.a].forEach((n) => existe(n, ["angles", i])));
    const xs = g.points.map((p) => p.x);
    const ys = g.points.map((p) => p.y);
    if (Math.max(...xs) - Math.min(...xs) > 1e4 || Math.max(...ys) - Math.min(...ys) > 1e4) {
      ctx.addIssue({ code: "custom", message: "Coordonnées trop éloignées" });
    }
  });

// ---------------------------------------------------------------- Union
export const figureSchema = z.union([
  repereSchema,
  tableauSignesSchema,
  tableauVariationsSchema,
  diagrammeStatistiqueSchema,
  arbreProbabilitesSchema,
  geometriePlaneSchema,
]);

export type Figure = z.infer<typeof figureSchema>;
export type FigureRepere = z.infer<typeof repereSchema>;
export type FigureTableauSignes = z.infer<typeof tableauSignesSchema>;
export type FigureTableauVariations = z.infer<typeof tableauVariationsSchema>;
export type FigureDiagramme = z.infer<typeof diagrammeStatistiqueSchema>;
export type FigureArbre = z.infer<typeof arbreProbabilitesSchema>;
export type FigureGeometrie = z.infer<typeof geometriePlaneSchema>;

const TYPES_FIGURE = ["repere", "tableau_signes", "tableau_variations", "diagramme_statistique", "arbre_probabilites", "geometrie_plane"];

/**
 * Valide une figure venue de l'IA, d'un admin ou de la base. Les erreurs sont en français et
 * ciblées (on valide avec le schéma du type annoncé, pas avec l'union, pour des messages utiles).
 */
export function validerFigure(entree: unknown): { ok: true; figure: Figure } | { ok: false; erreurs: string[] } {
  const type = (entree as { type?: unknown } | null)?.type;
  if (typeof type !== "string" || !TYPES_FIGURE.includes(type)) {
    return { ok: false, erreurs: [`Type de figure inconnu : ${String(type)} (attendu : ${TYPES_FIGURE.join(", ")})`] };
  }
  const schema = {
    repere: repereSchema,
    tableau_signes: tableauSignesSchema,
    tableau_variations: tableauVariationsSchema,
    diagramme_statistique: diagrammeStatistiqueSchema,
    arbre_probabilites: arbreProbabilitesSchema,
    geometrie_plane: geometriePlaneSchema,
  }[type as "repere"] as z.ZodType<Figure>;
  const r = schema.safeParse(entree);
  if (r.success) return { ok: true, figure: r.data };
  return { ok: false, erreurs: r.error.issues.map((i) => (i.path.length ? `${i.path.join(".")} : ${i.message}` : i.message)) };
}

/** Schéma Zod réutilisable dans les API : figure facultative, refusée si invalide. */
export const figureOptionnelleSchema = z
  .unknown()
  .nullable()
  .optional()
  .superRefine((f, ctx) => {
    if (f === null || f === undefined) return;
    const r = validerFigure(f);
    if (!r.ok) ctx.addIssue({ code: "custom", message: `Figure invalide — ${r.erreurs.join(" ; ")}` });
  });
