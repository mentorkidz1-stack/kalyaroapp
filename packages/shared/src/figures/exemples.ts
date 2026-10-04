// Figures de référence (critère d'acceptation du chantier 2.3) : page /admin/demo-figures,
// tests de validation et de rendu, et exemples montrés à l'IA dans les prompts.

export const EXEMPLES_FIGURES: { titre: string; figure: unknown }[] = [
  {
    titre: "Triangle rectangle avec longueurs",
    figure: {
      type: "geometrie_plane",
      points: [
        { nom: "A", x: 0, y: 0 },
        { nom: "B", x: 4, y: 0 },
        { nom: "C", x: 0, y: 3 },
      ],
      segments: [
        { de: "A", a: "B", longueur: "4 cm" },
        { de: "A", a: "C", longueur: "3 cm" },
        { de: "B", a: "C", longueur: "?" },
      ],
      angles: [{ sommet: "A", de: "B", a: "C", droit: true }],
    },
  },
  {
    titre: "Configuration de Thalès",
    figure: {
      type: "geometrie_plane",
      points: [
        { nom: "A", x: 1, y: 5 },
        { nom: "B", x: 0, y: 0 },
        { nom: "C", x: 6, y: 0 },
        { nom: "M", x: 0.6, y: 3 },
        { nom: "N", x: 3, y: 3 },
      ],
      segments: [
        { de: "A", a: "B" },
        { de: "A", a: "C" },
        { de: "B", a: "C", longueur: "6", parallele: 1 },
        { de: "M", a: "N", longueur: "x", parallele: 1 },
        { de: "A", a: "M", longueur: "2" },
      ],
    },
  },
  {
    titre: "Droite et parabole dans un repère",
    figure: {
      type: "repere",
      xMin: -3,
      xMax: 6,
      yMin: -3,
      yMax: 9,
      grille: true,
      elements: [
        { type: "courbe", expression: "x² − 2x − 1", nom: "𝒫" },
        { type: "droite", a: 2, b: -1, nom: "d" },
        { type: "point", x: 0, y: -1, nom: "A" },
        { type: "point", x: 4, y: 7, nom: "B" },
      ],
    },
  },
  {
    titre: "Tableau de variations de f(x) = x² − 4x + 3",
    figure: {
      type: "tableau_variations",
      variable: "x",
      fonction: "f",
      valeursX: ["−∞", "2", "+∞"],
      derivee: { libelle: "f'(x)", signes: ["-", "+"], marques: ["", "0", ""] },
      variations: ["decroissante", "croissante"],
      valeurs: ["+∞", "−1", "+∞"],
    },
  },
  {
    titre: "Tableau de signes de (x − 1)(x + 2)",
    figure: {
      type: "tableau_signes",
      valeursX: ["−∞", "−2", "1", "+∞"],
      lignes: [
        { libelle: "x − 1", signes: ["-", "-", "+"], marques: ["", "", "0", ""] },
        { libelle: "x + 2", signes: ["-", "+", "+"], marques: ["", "0", "", ""] },
        { libelle: "(x − 1)(x + 2)", signes: ["+", "-", "+"], marques: ["", "0", "0", ""] },
      ],
    },
  },
  {
    titre: "Arbre de probabilités à deux niveaux",
    figure: {
      type: "arbre_probabilites",
      branches: [
        {
          evenement: "A",
          probabilite: "0,3",
          enfants: [
            { evenement: "B", probabilite: "0,6" },
            { evenement: "B̄", probabilite: "0,4" },
          ],
        },
        {
          evenement: "Ā",
          probabilite: "0,7",
          enfants: [
            { evenement: "B", probabilite: "0,2" },
            { evenement: "B̄", probabilite: "0,8" },
          ],
        },
      ],
    },
  },
  {
    titre: "Offre et demande (repère, courbes et zone)",
    figure: {
      type: "repere",
      xMin: 0,
      xMax: 10,
      yMin: 0,
      yMax: 12,
      legendeX: "Quantité q",
      legendeY: "Prix p",
      elements: [
        { type: "courbe", expression: "10 − 0,8x", nom: "Demande" },
        { type: "courbe", expression: "2 + 0,8x", nom: "Offre" },
        { type: "point", x: 5, y: 6, nom: "E" },
        { type: "zone", haut: "10 − 0,8x", bas: "6", xMin: 0, xMax: 5, nom: "Surplus" },
      ],
    },
  },
  {
    titre: "Histogramme (classes d'âge)",
    figure: {
      type: "diagramme_statistique",
      sousType: "histogramme",
      titre: "Âge des clients",
      legendeX: "Âge (ans)",
      classes: [
        { min: 15, max: 20, effectif: 12 },
        { min: 20, max: 25, effectif: 30 },
        { min: 25, max: 35, effectif: 24 },
        { min: 35, max: 50, effectif: 9 },
      ],
    },
  },
  {
    titre: "Boîte à moustaches",
    figure: { type: "diagramme_statistique", sousType: "boite_moustaches", titre: "Notes du TD", min: 4, q1: 8, mediane: 11, q3: 13.5, max: 18 },
  },
  {
    titre: "Diagramme en barres",
    figure: {
      type: "diagramme_statistique",
      sousType: "barres",
      titre: "Ventes par marché",
      categories: ["Dantokpa", "Ouando", "Arzèkè", "Glazoué"],
      valeurs: [42, 18, 25, 11],
    },
  },
  {
    titre: "Nuage de points et droite d'ajustement",
    figure: {
      type: "diagramme_statistique",
      sousType: "nuage_points",
      legendeX: "Publicité (k F)",
      legendeY: "Ventes (k F)",
      points: [[1, 3.2], [2, 4.1], [3, 5.3], [4, 5.9], [5, 7.2], [6, 7.8]],
      ajustement: { a: 0.93, b: 2.3 },
    },
  },
];

/** Figure volontairement incohérente : la dérivée est positive mais la fonction « décroît ». */
export const EXEMPLE_FIGURE_INVALIDE: unknown = {
  type: "tableau_variations",
  valeursX: ["−∞", "2", "+∞"],
  derivee: { libelle: "f'(x)", signes: ["+", "+"], marques: ["", "0", ""] },
  variations: ["decroissante", "croissante"],
  valeurs: ["+∞", "−1", "+∞"],
};
