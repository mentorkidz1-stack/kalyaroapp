// Exemples de référence pour l'affichage mathématique : utilisés par la page interne
// /admin/demo-maths et par les tests de rendu (math-rendu.test.tsx).
export const EXEMPLES_MATHS: { titre: string; texte: string }[] = [
  {
    titre: "Texte Unicode existant (inchangé)",
    texte: "Pour 2x² − 4x − 6 = 0, on calcule Δ = b² − 4ac = 16 + 48 = 64, donc √Δ = 8 et x ≈ 3.",
  },
  {
    titre: "Ancienne notation x^2 générée par l'IA (convertie comme avant)",
    texte: "Résous x^2 − 5x + 6 = 0.",
  },
  {
    titre: "Fraction en ligne",
    texte: "La probabilité vaut $\\frac{3}{8}$, soit un peu moins de la moitié.",
  },
  {
    titre: "Système 2×2",
    texte: "Résous le système : $$\\begin{cases} 2x + 3y = 7 \\\\ x - y = 1 \\end{cases}$$",
  },
  {
    titre: "Vecteur",
    texte: "Les coordonnées du vecteur sont $\\vec{u} = \\begin{pmatrix} 2 \\\\ -3 \\end{pmatrix}$.",
  },
  {
    titre: "Intégrale",
    texte: "Calcule $$\\int_{0}^{1} (3x^2 + 2x)\\,dx$$",
  },
  {
    titre: "Matrice et racine composée",
    texte: "Soit $A = \\begin{pmatrix} 1 & 2 \\\\ 0 & 1 \\end{pmatrix}$ et $r = \\sqrt{\\frac{a+b}{2}}$.",
  },
  {
    titre: "Montants en francs ou dollars (pas une formule)",
    texte: "Le livre coûte 5 $ et le cahier 3 $ ; échappé : \\$10.",
  },
];
