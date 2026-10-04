import type { FigureDiagramme } from "@kalyaro/shared";
import { COULEURS, Etiquette, LARGEUR, POLICE, formatNombre, graduations, pasRond } from "./outils";

const M = { gauche: 40, droite: 14, haut: 26, bas: 40 };
const H_TRACE = 220;

/** Diagrammes statistiques : barres, histogramme, boîte à moustaches, nuage de points. */
export function Diagramme({ figure }: { figure: FigureDiagramme }) {
  const largeur = LARGEUR - M.gauche - M.droite;
  const hauteur = H_TRACE + M.haut + M.bas;
  const titre = figure.titre ? (
    <Etiquette x={LARGEUR / 2} y={12} taille={12} gras>
      {figure.titre}
    </Etiquette>
  ) : null;
  const legendeX = figure.legendeX ? (
    <Etiquette x={M.gauche + largeur} y={hauteur - 8} taille={11} ancre="end" couleur={COULEURS.encreDouce}>
      {figure.legendeX}
    </Etiquette>
  ) : null;
  const legendeY = figure.legendeY ? (
    <Etiquette x={4} y={M.haut - 8} taille={11} ancre="start" couleur={COULEURS.encreDouce}>
      {figure.legendeY}
    </Etiquette>
  ) : null;
  const svg = (contenu: React.ReactNode, h = hauteur) => (
    <svg viewBox={`0 0 ${LARGEUR} ${h}`} role="img" aria-label={figure.titre ?? "Diagramme statistique"} className="w-full h-auto" fontFamily={POLICE}>
      {titre}
      {contenu}
      {legendeX}
      {legendeY}
    </svg>
  );

  // Axe vertical gradué de 0 à `max`.
  const axeY = (max: number) => {
    const pas = pasRond(max, 5);
    const Y = (v: number) => M.haut + H_TRACE - (v / max) * H_TRACE;
    return {
      Y,
      rendu: (
        <g>
          <line x1={M.gauche} x2={M.gauche} y1={M.haut} y2={M.haut + H_TRACE} stroke={COULEURS.encre} />
          {graduations(0, max, pas).map((g) => (
            <g key={g}>
              <line x1={M.gauche - 3} x2={M.gauche + largeur} y1={Y(g)} y2={Y(g)} stroke={g === 0 ? COULEURS.encre : COULEURS.ligne} />
              <Etiquette x={M.gauche - 6} y={Y(g)} taille={11} ancre="end" couleur={COULEURS.encreDouce}>
                {formatNombre(g)}
              </Etiquette>
            </g>
          ))}
        </g>
      ),
    };
  };

  if (figure.sousType === "barres") {
    const max = Math.max(...figure.valeurs, 1) * 1.15;
    const { Y, rendu } = axeY(max);
    const pas = largeur / figure.categories.length;
    return svg(
      <g>
        {rendu}
        {figure.categories.map((c, i) => {
          const v = figure.valeurs[i] ?? 0;
          const x = M.gauche + i * pas + pas * 0.18;
          return (
            <g key={i}>
              <rect x={x} y={Y(v)} width={pas * 0.64} height={M.haut + H_TRACE - Y(v)} fill={COULEURS.principale} rx={2} />
              <Etiquette x={x + pas * 0.32} y={Y(v) - 8} taille={11}>
                {formatNombre(v)}
              </Etiquette>
              <Etiquette x={x + pas * 0.32} y={M.haut + H_TRACE + 12} taille={figure.categories.length > 6 ? 8 : 10}>
                {c}
              </Etiquette>
            </g>
          );
        })}
      </g>
    );
  }

  if (figure.sousType === "histogramme") {
    // Hauteur = densité (effectif / amplitude) : l'AIRE de chaque rectangle est proportionnelle à l'effectif.
    const min = figure.classes[0]!.min;
    const max = figure.classes[figure.classes.length - 1]!.max;
    const X = (v: number) => M.gauche + ((v - min) / (max - min)) * largeur;
    const densites = figure.classes.map((c) => c.effectif / (c.max - c.min));
    const dMax = Math.max(...densites, 1e-9) * 1.15;
    const Y = (d: number) => M.haut + H_TRACE - (d / dMax) * H_TRACE;
    const bornes = [...new Set(figure.classes.flatMap((c) => [c.min, c.max]))];
    return svg(
      <g>
        <line x1={M.gauche} x2={M.gauche + largeur} y1={M.haut + H_TRACE} y2={M.haut + H_TRACE} stroke={COULEURS.encre} />
        {figure.classes.map((c, i) => (
          <g key={i}>
            <rect
              x={X(c.min)}
              y={Y(densites[i]!)}
              width={X(c.max) - X(c.min)}
              height={M.haut + H_TRACE - Y(densites[i]!)}
              fill={COULEURS.principale}
              fillOpacity={0.85}
              stroke={COULEURS.fond}
              strokeWidth={1.5}
            />
            <Etiquette x={(X(c.min) + X(c.max)) / 2} y={Y(densites[i]!) - 8} taille={11}>
              {formatNombre(c.effectif)}
            </Etiquette>
          </g>
        ))}
        {bornes.map((b) => (
          <Etiquette key={b} x={X(b)} y={M.haut + H_TRACE + 12} taille={11} couleur={COULEURS.encreDouce}>
            {formatNombre(b)}
          </Etiquette>
        ))}
        {/* Classes d'amplitudes différentes : c'est l'AIRE qui représente l'effectif, à rappeler. */}
        <Etiquette x={M.gauche} y={hauteur + 8} taille={10} ancre="start" couleur={COULEURS.encreDouce}>
          Effectif au-dessus de chaque classe — l'aire du rectangle est proportionnelle à l'effectif
        </Etiquette>
      </g>,
      hauteur + 18
    );
  }

  if (figure.sousType === "boite_moustaches") {
    const { min, q1, mediane, q3, max } = figure;
    const marge = (max - min || 1) * 0.08;
    const debut = min - marge;
    const fin = max + marge;
    const X = (v: number) => M.gauche + ((v - debut) / (fin - debut)) * largeur;
    const yAxe = 150;
    const yBoite = 70;
    const hBoite = 44;
    const pas = pasRond(fin - debut, 8);
    return svg(
      <g>
        <line x1={M.gauche} x2={M.gauche + largeur} y1={yAxe} y2={yAxe} stroke={COULEURS.encre} />
        {graduations(debut, fin, pas).map((g) => (
          <g key={g}>
            <line x1={X(g)} x2={X(g)} y1={yAxe - 3} y2={yAxe + 3} stroke={COULEURS.encre} />
            <Etiquette x={X(g)} y={yAxe + 13} taille={11} couleur={COULEURS.encreDouce}>
              {formatNombre(g)}
            </Etiquette>
          </g>
        ))}
        <g stroke={COULEURS.encre} strokeWidth={1.6}>
          <line x1={X(min)} x2={X(q1)} y1={yBoite + hBoite / 2} y2={yBoite + hBoite / 2} />
          <line x1={X(q3)} x2={X(max)} y1={yBoite + hBoite / 2} y2={yBoite + hBoite / 2} />
          <line x1={X(min)} x2={X(min)} y1={yBoite + 10} y2={yBoite + hBoite - 10} />
          <line x1={X(max)} x2={X(max)} y1={yBoite + 10} y2={yBoite + hBoite - 10} />
        </g>
        <rect x={X(q1)} y={yBoite} width={X(q3) - X(q1)} height={hBoite} fill="var(--primary-tint)" stroke={COULEURS.principale} strokeWidth={1.8} />
        <line x1={X(mediane)} x2={X(mediane)} y1={yBoite} y2={yBoite + hBoite} stroke={COULEURS.alerte} strokeWidth={2.4} />
        {[
          ["min", min],
          ["Q1", q1],
          ["Me", mediane],
          ["Q3", q3],
          ["max", max],
        ].map(([nom, v], i) => (
          <Etiquette key={nom as string} x={X(v as number)} y={i % 2 === 0 ? yBoite - 12 : yBoite + hBoite + 12} taille={11} gras>
            {`${nom} = ${formatNombre(v as number)}`}
          </Etiquette>
        ))}
      </g>,
      190
    );
  }

  // Nuage de points
  const xs = figure.points.map((p) => p[0]);
  const ys = figure.points.map((p) => p[1]);
  const etendre = (a: number, b: number) => {
    const m = (b - a || 1) * 0.1;
    return [Math.min(0, a - m) === 0 && a >= 0 ? 0 : a - m, b + m] as const;
  };
  const [xMin, xMax] = etendre(Math.min(...xs), Math.max(...xs));
  const [yMin, yMax] = etendre(Math.min(...ys), Math.max(...ys));
  const X = (v: number) => M.gauche + ((v - xMin) / (xMax - xMin)) * largeur;
  const Y = (v: number) => M.haut + H_TRACE - ((v - yMin) / (yMax - yMin)) * H_TRACE;
  const gx = graduations(xMin, xMax, pasRond(xMax - xMin, 7));
  const gy = graduations(yMin, yMax, pasRond(yMax - yMin, 5));
  return svg(
    <g>
      <rect x={M.gauche} y={M.haut} width={largeur} height={H_TRACE} fill="none" stroke={COULEURS.encre} />
      {gx.map((g) => (
        <g key={`x${g}`}>
          <line x1={X(g)} x2={X(g)} y1={M.haut} y2={M.haut + H_TRACE} stroke={COULEURS.ligne} />
          <Etiquette x={X(g)} y={M.haut + H_TRACE + 12} taille={11} couleur={COULEURS.encreDouce}>
            {formatNombre(g)}
          </Etiquette>
        </g>
      ))}
      {gy.map((g) => (
        <g key={`y${g}`}>
          <line x1={M.gauche} x2={M.gauche + largeur} y1={Y(g)} y2={Y(g)} stroke={COULEURS.ligne} />
          <Etiquette x={M.gauche - 6} y={Y(g)} taille={11} ancre="end" couleur={COULEURS.encreDouce}>
            {formatNombre(g)}
          </Etiquette>
        </g>
      ))}
      {figure.ajustement && (
        <g>
          <clipPath id="ajustement-clip">
            <rect x={M.gauche} y={M.haut} width={largeur} height={H_TRACE} />
          </clipPath>
          <line
            clipPath="url(#ajustement-clip)"
            x1={X(xMin)}
            y1={Y(figure.ajustement.a * xMin + figure.ajustement.b)}
            x2={X(xMax)}
            y2={Y(figure.ajustement.a * xMax + figure.ajustement.b)}
            stroke={COULEURS.alerte}
            strokeWidth={1.8}
          />
        </g>
      )}
      {figure.points.map(([x, y], i) => (
        <g key={i} stroke={COULEURS.principaleProfonde} strokeWidth={2}>
          <line x1={X(x) - 4} x2={X(x) + 4} y1={Y(y) - 4} y2={Y(y) + 4} />
          <line x1={X(x) - 4} x2={X(x) + 4} y1={Y(y) + 4} y2={Y(y) - 4} />
        </g>
      ))}
    </g>
  );
}
