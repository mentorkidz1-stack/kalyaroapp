import type { BrancheArbre, FigureArbre } from "@kalyaro/shared";
import { COULEURS, Etiquette, LARGEUR, POLICE } from "./outils";

const ESPACE_FEUILLES = 46;
const MARGE = 18;

interface NoeudPlace {
  evenement: string;
  probabilite: string;
  x: number;
  y: number;
  parent: { x: number; y: number };
  enfants: NoeudPlace[];
}

function nbFeuilles(b: BrancheArbre): number {
  return b.enfants?.length ? b.enfants.reduce((s, e) => s + nbFeuilles(e), 0) : 1;
}

function profondeur(b: BrancheArbre[]): number {
  return 1 + Math.max(0, ...b.map((x) => (x.enfants ? profondeur(x.enfants) : 0)));
}

/** Arbre de probabilités horizontal : racine à gauche, probabilité au milieu de chaque branche. */
export function Arbre({ figure }: { figure: FigureArbre }) {
  const niveaux = profondeur(figure.branches);
  const feuillesTotal = figure.branches.reduce((s, b) => s + nbFeuilles(b), 0);
  const hauteur = feuillesTotal * ESPACE_FEUILLES + 2 * MARGE;
  const pasX = (LARGEUR - 2 * MARGE - 20) / niveaux;
  const racine = { x: MARGE, y: hauteur / 2 };

  // Place les nœuds : chaque sous-arbre occupe une bande verticale proportionnelle à ses feuilles.
  const placer = (branches: BrancheArbre[], niveau: number, yDebut: number, parent: { x: number; y: number }): NoeudPlace[] => {
    let y = yDebut;
    return branches.map((b) => {
      const bande = nbFeuilles(b) * ESPACE_FEUILLES;
      const noeud = { x: MARGE + niveau * pasX, y: y + bande / 2 };
      const place: NoeudPlace = {
        evenement: b.evenement,
        probabilite: b.probabilite,
        ...noeud,
        parent,
        enfants: b.enfants ? placer(b.enfants, niveau + 1, y, noeud) : [],
      };
      y += bande;
      return place;
    });
  };
  const arbre = placer(figure.branches, 1, MARGE, racine);
  const tous: NoeudPlace[] = [];
  const parcourir = (n: NoeudPlace[]) => n.forEach((x) => (tous.push(x), parcourir(x.enfants)));
  parcourir(arbre);

  return (
    <svg viewBox={`0 0 ${LARGEUR} ${hauteur}`} role="img" aria-label="Arbre de probabilités" className="w-full h-auto" fontFamily={POLICE}>
      <circle cx={racine.x} cy={racine.y} r={3} fill={COULEURS.encre} />
      {tous.map((n, i) => (
        <g key={`b${i}`}>
          <line x1={n.parent.x + 6} y1={n.parent.y} x2={n.x - 12} y2={n.y} stroke={COULEURS.encre} strokeWidth={1.3} />
          <Etiquette
            x={(n.parent.x + n.x) / 2 - 4}
            y={(n.parent.y + n.y) / 2 + (n.y < n.parent.y ? -11 : n.y > n.parent.y ? 11 : -11)}
            taille={13}
            couleur={COULEURS.principaleProfonde}
            gras
          >
            {n.probabilite}
          </Etiquette>
        </g>
      ))}
      {tous.map((n, i) => (
        <Etiquette key={`n${i}`} x={n.x} y={n.y} taille={15} gras>
          {n.evenement}
        </Etiquette>
      ))}
    </svg>
  );
}
