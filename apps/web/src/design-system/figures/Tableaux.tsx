import type { FigureTableauSignes, FigureTableauVariations } from "@kalyaro/shared";
import { COULEURS, DefsFleches, Etiquette, LARGEUR, POLICE } from "./outils";

const COLONNE_LIBELLES = 92;
const PADDING = 22;
const H_LIGNE = 34;
const H_VARIATIONS = 78;

type Ligne = { libelle: string; signes: ("+" | "-")[]; marques: ("" | "0" | "||")[] };

/** Abscisse de la i-ème valeur de x (les valeurs sont réparties régulièrement). */
const positionX = (i: number, n: number) => COLONNE_LIBELLES + PADDING + (i * (LARGEUR - COLONNE_LIBELLES - 2 * PADDING)) / (n - 1);

function Cadre({ hauteur, lignesY }: { hauteur: number; lignesY: number[] }) {
  return (
    <g stroke={COULEURS.encre} strokeWidth={1.2} fill="none">
      <rect x={1} y={1} width={LARGEUR - 2} height={hauteur - 2} />
      <line x1={COLONNE_LIBELLES} x2={COLONNE_LIBELLES} y1={1} y2={hauteur - 1} />
      {lignesY.map((y) => (
        <line key={y} x1={1} x2={LARGEUR - 1} y1={y} y2={y} />
      ))}
    </g>
  );
}

function LigneX({ variable, valeurs }: { variable: string; valeurs: string[] }) {
  return (
    <g>
      <Etiquette x={COLONNE_LIBELLES / 2} y={H_LIGNE / 2} gras>
        {variable}
      </Etiquette>
      {valeurs.map((v, i) => (
        <Etiquette key={i} x={positionX(i, valeurs.length)} y={H_LIGNE / 2}>
          {v}
        </Etiquette>
      ))}
    </g>
  );
}

/** Ligne de signes : un signe par intervalle, un « 0 » ou une double barre sous les valeurs de x. */
function LigneSignes({ ligne, y, n }: { ligne: Ligne; y: number; n: number }) {
  const milieu = y + H_LIGNE / 2;
  return (
    <g>
      <Etiquette x={COLONNE_LIBELLES / 2} y={milieu} taille={12}>
        {ligne.libelle}
      </Etiquette>
      {ligne.signes.map((s, i) => (
        <Etiquette key={`s${i}`} x={(positionX(i, n) + positionX(i + 1, n)) / 2} y={milieu} taille={17} gras>
          {s === "-" ? "−" : "+"}
        </Etiquette>
      ))}
      {ligne.marques.map((m, i) => {
        const x = positionX(i, n);
        if (m === "0") {
          return (
            <g key={`m${i}`}>
              <line x1={x} x2={x} y1={y} y2={y + H_LIGNE} stroke={COULEURS.encreDouce} strokeDasharray="2 3" />
              <Etiquette x={x} y={milieu} gras>
                0
              </Etiquette>
            </g>
          );
        }
        if (m === "||") return <DoubleBarre key={`m${i}`} x={x} y1={y} y2={y + H_LIGNE} />;
        return null;
      })}
    </g>
  );
}

function DoubleBarre({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return (
    <g stroke={COULEURS.encre} strokeWidth={1.4}>
      <line x1={x - 2} x2={x - 2} y1={y1} y2={y2} />
      <line x1={x + 2} x2={x + 2} y1={y1} y2={y2} />
    </g>
  );
}

export function TableauSignes({ figure }: { figure: FigureTableauSignes }) {
  const n = figure.valeursX.length;
  const hauteur = H_LIGNE * (1 + figure.lignes.length);
  return (
    <svg viewBox={`0 0 ${LARGEUR} ${hauteur}`} role="img" aria-label="Tableau de signes" className="w-full h-auto" fontFamily={POLICE}>
      <Cadre hauteur={hauteur} lignesY={figure.lignes.map((_, i) => H_LIGNE * (i + 1))} />
      <LigneX variable={figure.variable} valeurs={figure.valeursX} />
      {figure.lignes.map((l, i) => (
        <LigneSignes key={i} ligne={l} y={H_LIGNE * (i + 1)} n={n} />
      ))}
    </svg>
  );
}

export function TableauVariations({ figure, id }: { figure: FigureTableauVariations; id: string }) {
  const n = figure.valeursX.length;
  const yDerivee = H_LIGNE;
  const yVariations = H_LIGNE * (figure.derivee ? 2 : 1);
  const hauteur = yVariations + H_VARIATIONS;
  const haut = yVariations + 14;
  const bas = yVariations + H_VARIATIONS - 14;

  // Une valeur se place en haut si la fonction y arrive en montant ou en repart en descendant.
  const enHaut = (i: number): boolean => {
    const avant = figure.variations[i - 1];
    const apres = figure.variations[i];
    if (avant === "croissante") return true;
    if (avant === "decroissante") return false;
    if (apres === "decroissante") return true;
    if (apres === "croissante") return false;
    return true; // constante : en haut par convention
  };
  const yValeur = (i: number) => (figure.valeurs[i] === "||" ? (haut + bas) / 2 : enHaut(i) ? haut : bas);

  return (
    <svg
      viewBox={`0 0 ${LARGEUR} ${hauteur}`}
      role="img"
      aria-label={`Tableau de variations de ${figure.fonction}`}
      className="w-full h-auto"
      fontFamily={POLICE}
    >
      <DefsFleches id={id} />
      <Cadre hauteur={hauteur} lignesY={figure.derivee ? [H_LIGNE, H_LIGNE * 2] : [H_LIGNE]} />
      <LigneX variable={figure.variable} valeurs={figure.valeursX} />
      {figure.derivee && <LigneSignes ligne={figure.derivee} y={yDerivee} n={n} />}

      <Etiquette x={COLONNE_LIBELLES / 2} y={yVariations + H_VARIATIONS / 2} gras>
        {figure.fonction}
      </Etiquette>
      {figure.valeurs.map((v, i) =>
        v === "||" ? (
          <DoubleBarre key={`v${i}`} x={positionX(i, n)} y1={yVariations} y2={hauteur} />
        ) : v ? (
          <Etiquette key={`v${i}`} x={positionX(i, n)} y={yValeur(i)}>
            {v}
          </Etiquette>
        ) : null
      )}
      {figure.variations.map((sens, i) => {
        // Flèche d'une valeur à la suivante, raccourcie pour ne pas toucher le texte.
        const x1 = positionX(i, n) + 16;
        const x2 = positionX(i + 1, n) - 16;
        const y1 = sens === "constante" ? (haut + bas) / 2 : sens === "croissante" ? bas : haut;
        const y2 = sens === "constante" ? (haut + bas) / 2 : sens === "croissante" ? haut : bas;
        return <line key={`f${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COULEURS.encre} strokeWidth={1.4} markerEnd={`url(#${id}-fleche)`} />;
      })}
    </svg>
  );
}
