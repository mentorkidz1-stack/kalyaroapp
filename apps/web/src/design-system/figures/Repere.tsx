import { aimanter, compilerExpression, type FigureRepere } from "@kalyaro/shared";
import { COULEURS, DefsFleches, Etiquette, LARGEUR, PALETTE, formatNombre, graduations, pasRond } from "./outils";

const MARGE_BASE = { droite: 14, haut: 16 };
const ECHANTILLONS = 480;

/** Réponse « placer un point » : l'étudiant touche le repère, le point s'aimante à la grille. */
export interface InteractionRepere {
  point: [number, number] | null;
  onPlacer: (x: number, y: number) => void;
  /** Pas d'aimantation ; à défaut, un dixième de graduation. */
  pasGrille?: number | null;
  desactive?: boolean;
  /** Après correction : le point prend la couleur du verdict (la position attendue n'est pas
   * dévoilée, comme pour les QCM à choix : l'indice guide, la question peut revenir). */
  correct?: boolean | null;
}

/** Repère : axes gradués, grille, points, droites, courbes, segments, vecteurs, zones. */
export function Repere({ figure, id, interaction }: { figure: FigureRepere; id: string; interaction?: InteractionRepere }) {
  const { xMin, xMax, yMin, yMax } = figure;
  // Axe collé au bord (repère économique q ≥ 0, p ≥ 0) : de la place pour les graduations.
  const MARGE = { ...MARGE_BASE, gauche: xMin >= 0 ? 34 : 16, bas: yMin >= 0 ? 26 : 16 };
  const largeurUtile = LARGEUR - MARGE.gauche - MARGE.droite;
  // Repère orthonormé quand c'est raisonnable, sinon hauteur bornée pour rester lisible.
  const hauteurUtile = Math.min(420, Math.max(220, (largeurUtile * (yMax - yMin)) / (xMax - xMin)));
  const hauteur = hauteurUtile + MARGE.haut + MARGE.bas;
  const X = (x: number) => MARGE.gauche + ((x - xMin) / (xMax - xMin)) * largeurUtile;
  const Y = (y: number) => MARGE.haut + ((yMax - y) / (yMax - yMin)) * hauteurUtile;

  const pasX = figure.pasX ?? pasRond(xMax - xMin);
  const pasY = figure.pasY ?? pasRond(yMax - yMin, Math.max(4, Math.round(hauteurUtile / 40)));
  const gradX = graduations(xMin, xMax, pasX);
  const gradY = graduations(yMin, yMax, pasY);
  // Axes en 0 s'ils sont dans la fenêtre, sinon sur le bord (repère économique en q ≥ 0, p ≥ 0).
  const axeX = Y(Math.min(Math.max(0, yMin), yMax));
  const axeY = X(Math.min(Math.max(0, xMin), xMax));
  const clip = `${id}-zone`;

  // Toucher → coordonnées du repère. onClick (et non pointerdown) : un glissement du doigt
  // reste un défilement de la page, seul un vrai toucher place le point.
  const placer = (e: React.MouseEvent<SVGRectElement>) => {
    if (!interaction || interaction.desactive) return;
    const svg = e.currentTarget.ownerSVGElement;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const pas = interaction.pasGrille ?? pasX / 10;
    const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
    const x = aimanter(borne(xMin + ((p.x - MARGE.gauche) / largeurUtile) * (xMax - xMin), xMin, xMax), pas);
    const y = aimanter(borne(yMax - ((p.y - MARGE.haut) / hauteurUtile) * (yMax - yMin), yMin, yMax), pas);
    interaction.onPlacer(x, y);
  };
  const posePoint = interaction?.point;
  const couleurPose =
    interaction?.correct === true ? COULEURS.principale : interaction?.correct === false ? COULEURS.alerte : COULEURS.principaleProfonde;

  const courbe = (expr: string, de: number, a: number): string => {
    const r = compilerExpression(expr);
    if (!r.ok) return "";
    let d = "";
    let precedent: number | null = null;
    for (let i = 0; i <= ECHANTILLONS; i++) {
      const x = de + ((a - de) * i) / ECHANTILLONS;
      const y = r.f(x);
      // Coupure aux points où la fonction n'est pas définie ou « saute » (asymptote verticale).
      const valide = Number.isFinite(y) && Math.abs(y) < 1e6;
      const saut = precedent !== null && valide && Math.abs(y - precedent) > (yMax - yMin) * 2;
      if (!valide || saut) {
        precedent = valide ? y : null;
        if (!valide) continue;
        d += ` M${X(x).toFixed(2)},${Y(y).toFixed(2)}`;
        continue;
      }
      d += `${precedent === null ? " M" : " L"}${X(x).toFixed(2)},${Y(y).toFixed(2)}`;
      precedent = y;
    }
    return d.trim();
  };

  const zone = (haut: string, bas: string | undefined, de: number, a: number): string => {
    const h = compilerExpression(haut);
    const b = bas ? compilerExpression(bas) : null;
    if (!h.ok || (b && !b.ok)) return "";
    const fb = b && b.ok ? b.f : () => 0;
    const n = 120;
    const xs = Array.from({ length: n + 1 }, (_, i) => de + ((a - de) * i) / n);
    const dessus = xs.map((x) => `${X(x).toFixed(2)},${Y(h.f(x)).toFixed(2)}`);
    const dessous = [...xs].reverse().map((x) => `${X(x).toFixed(2)},${Y(fb(x)).toFixed(2)}`);
    return `M${dessus.join(" L")} L${dessous.join(" L")} Z`;
  };

  let couleur = 0;
  const prochaineCouleur = () => PALETTE[couleur++ % PALETTE.length]!;

  return (
    <svg viewBox={`0 0 ${LARGEUR} ${hauteur}`} role="img" aria-label="Repère" className="w-full h-auto">
      <DefsFleches id={id} />
      <clipPath id={clip}>
        <rect x={MARGE.gauche} y={MARGE.haut} width={largeurUtile} height={hauteurUtile} />
      </clipPath>

      {figure.grille && (
        <g stroke={COULEURS.ligne} strokeWidth={1}>
          {gradX.map((g) => (
            <line key={`gx${g}`} x1={X(g)} x2={X(g)} y1={MARGE.haut} y2={MARGE.haut + hauteurUtile} />
          ))}
          {gradY.map((g) => (
            <line key={`gy${g}`} y1={Y(g)} y2={Y(g)} x1={MARGE.gauche} x2={MARGE.gauche + largeurUtile} />
          ))}
        </g>
      )}

      {/* Zones d'abord, pour rester sous les tracés. */}
      <g clipPath={`url(#${clip})`}>
        {figure.elements.map((e, i) =>
          e.type === "zone" ? (
            <path key={i} d={zone(e.haut, e.bas, e.xMin, e.xMax)} fill={COULEURS.accent} fillOpacity={0.3} stroke="none" />
          ) : null
        )}
      </g>

      {/* Axes gradués */}
      <g stroke={COULEURS.encre} strokeWidth={1.2}>
        <line x1={MARGE.gauche} x2={MARGE.gauche + largeurUtile + 6} y1={axeX} y2={axeX} markerEnd={`url(#${id}-fleche)`} />
        <line x1={axeY} x2={axeY} y1={MARGE.haut + hauteurUtile} y2={MARGE.haut - 6} markerEnd={`url(#${id}-fleche)`} />
        {gradX.map((g) => (
          <line key={`tx${g}`} x1={X(g)} x2={X(g)} y1={axeX - 3} y2={axeX + 3} />
        ))}
        {gradY.map((g) => (
          <line key={`ty${g}`} x1={axeY - 3} x2={axeY + 3} y1={Y(g)} y2={Y(g)} />
        ))}
      </g>
      {gradX.map((g) =>
        g === 0 && X(0) === axeY ? null : (
          <Etiquette key={`lx${g}`} x={X(g)} y={axeX + 11} taille={11.5} couleur={COULEURS.encreDouce}>
            {formatNombre(g)}
          </Etiquette>
        )
      )}
      {gradY.map((g) =>
        g === 0 && Y(0) === axeX ? null : (
          <Etiquette key={`ly${g}`} x={axeY - 6} y={Y(g)} taille={11.5} ancre="end" couleur={COULEURS.encreDouce}>
            {formatNombre(g)}
          </Etiquette>
        )
      )}
      {xMin <= 0 && 0 <= xMax && yMin <= 0 && 0 <= yMax && (
        <Etiquette x={axeY - 7} y={axeX + 10} taille={10} couleur={COULEURS.encreDouce}>
          O
        </Etiquette>
      )}
      {figure.legendeX && (
        <Etiquette x={MARGE.gauche + largeurUtile} y={axeX - 10} taille={11} ancre="end" couleur={COULEURS.encreDouce}>
          {figure.legendeX}
        </Etiquette>
      )}
      {figure.legendeY && (
        <Etiquette x={axeY + 6} y={MARGE.haut + 4} taille={11} ancre="start" couleur={COULEURS.encreDouce}>
          {figure.legendeY}
        </Etiquette>
      )}

      {/* Tracés */}
      <g clipPath={`url(#${clip})`} fill="none" strokeWidth={2} strokeLinecap="round">
        {figure.elements.map((e, i) => {
          if (e.type === "courbe") {
            const c = prochaineCouleur();
            return <path key={i} d={courbe(e.expression, Math.max(xMin, e.xMin ?? xMin), Math.min(xMax, e.xMax ?? xMax))} stroke={c} />;
          }
          if (e.type === "droite") {
            return <line key={i} x1={X(xMin)} y1={Y(e.a * xMin + e.b)} x2={X(xMax)} y2={Y(e.a * xMax + e.b)} stroke={prochaineCouleur()} />;
          }
          if (e.type === "verticale") {
            return <line key={i} x1={X(e.x)} x2={X(e.x)} y1={Y(yMin)} y2={Y(yMax)} stroke={prochaineCouleur()} strokeDasharray="5 4" />;
          }
          if (e.type === "segment") {
            return <line key={i} x1={X(e.de[0])} y1={Y(e.de[1])} x2={X(e.a[0])} y2={Y(e.a[1])} stroke={COULEURS.encre} />;
          }
          if (e.type === "vecteur") {
            return (
              <line key={i} x1={X(e.de[0])} y1={Y(e.de[1])} x2={X(e.a[0])} y2={Y(e.a[1])} stroke={COULEURS.principale} markerEnd={`url(#${id}-fleche-p)`} />
            );
          }
          return null;
        })}
      </g>

      {/* Points et noms (hors découpage pour que les noms ne soient pas coupés au bord). */}
      {(() => {
        couleur = 0; // même ordre d'attribution que les tracés : le nom prend la couleur de sa courbe
        return figure.elements.map((e, i) => {
          if (e.type === "verticale") {
            prochaineCouleur();
            return null;
          }
          if (e.type === "point") {
            if (e.x < xMin || e.x > xMax || e.y < yMin || e.y > yMax) return null;
            return (
              <g key={`p${i}`}>
                <circle cx={X(e.x)} cy={Y(e.y)} r={3.5} fill={COULEURS.encre} />
                {e.nom && (
                  <Etiquette x={X(e.x) + 8} y={Y(e.y) - 10} ancre="start" taille={14} gras>
                    {e.nom}
                  </Etiquette>
                )}
              </g>
            );
          }
          if (e.type === "courbe" || e.type === "droite") {
            const c = prochaineCouleur();
            if (!e.nom) return null;
            const pos = positionNomTrace(e, xMin, xMax, yMin, yMax);
            return pos ? (
              <Etiquette key={`n${i}`} x={X(pos[0])} y={Y(pos[1]) - 11} taille={13.5} couleur={c} gras>
                {e.nom}
              </Etiquette>
            ) : null;
          }
          if (e.type === "vecteur" && e.nom) {
            return (
              <Etiquette key={`n${i}`} x={(X(e.de[0]) + X(e.a[0])) / 2 + 8} y={(Y(e.de[1]) + Y(e.a[1])) / 2 - 8} couleur={COULEURS.principale} gras>
                {e.nom}
              </Etiquette>
            );
          }
          if (e.type === "zone" && e.nom) {
            const xm = (e.xMin + e.xMax) / 2;
            const h = compilerExpression(e.haut);
            const b = e.bas ? compilerExpression(e.bas) : null;
            if (!h.ok || (b && !b.ok)) return null;
            const ym = (h.f(xm) + (b && b.ok ? b.f(xm) : 0)) / 2;
            return (
              <Etiquette key={`n${i}`} x={X(xm)} y={Y(ym)} taille={11} couleur="#8A5A0E" gras>
                {e.nom}
              </Etiquette>
            );
          }
          return null;
        });
      })()}

      {interaction && (
        <>
          {posePoint && (
            <g pointerEvents="none">
              {/* Pointillés vers les axes : aident à lire les coordonnées du point posé. */}
              <g stroke={couleurPose} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.8}>
                <line x1={X(posePoint[0])} y1={Y(posePoint[1])} x2={X(posePoint[0])} y2={axeX} />
                <line x1={X(posePoint[0])} y1={Y(posePoint[1])} x2={axeY} y2={Y(posePoint[1])} />
              </g>
              <circle cx={X(posePoint[0])} cy={Y(posePoint[1])} r={6} fill={couleurPose} stroke={COULEURS.fond} strokeWidth={2} />
            </g>
          )}
          <rect
            x={MARGE.gauche}
            y={MARGE.haut}
            width={largeurUtile}
            height={hauteurUtile}
            fill="transparent"
            style={{ cursor: interaction.desactive ? "default" : "crosshair" }}
            onClick={placer}
            data-testid="zone-placement"
          />
        </>
      )}
    </svg>
  );
}

/** Où écrire le nom d'une courbe : vers la droite de la fenêtre, à un endroit visible. */
function positionNomTrace(
  e: { type: "courbe"; expression: string; xMin?: number; xMax?: number } | { type: "droite"; a: number; b: number },
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number
): [number, number] | null {
  const f =
    e.type === "droite"
      ? (x: number) => e.a * x + e.b
      : (() => {
          const r = compilerExpression(e.expression);
          return r.ok ? r.f : null;
        })();
  if (!f) return null;
  const de = e.type === "courbe" ? Math.max(xMin, e.xMin ?? xMin) : xMin;
  const a = e.type === "courbe" ? Math.min(xMax, e.xMax ?? xMax) : xMax;
  const marge = (yMax - yMin) * 0.06;
  for (let t = 0.92; t >= 0.08; t -= 0.04) {
    const x = de + (a - de) * t;
    const y = f(x);
    if (Number.isFinite(y) && y > yMin + marge && y < yMax - marge) return [x, y];
  }
  return null;
}
