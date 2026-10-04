import type { FigureGeometrie } from "@kalyaro/shared";
import { COULEURS, Etiquette, LARGEUR, POLICE } from "./outils";

const MARGE = 34;
const HAUTEUR_MAX = 340;

type Pt = { x: number; y: number };

/** Géométrie plane : la figure est mise à l'échelle (repère orthonormé implicite, non affiché). */
export function Geometrie({ figure }: { figure: FigureGeometrie }) {
  const parNom = new Map(figure.points.map((p) => [p.nom, p]));
  // Boîte englobante : points et cercles.
  const xs = figure.points.flatMap((p) => [p.x]);
  const ys = figure.points.flatMap((p) => [p.y]);
  for (const c of figure.cercles) {
    const o = parNom.get(c.centre);
    if (o) xs.push(o.x - c.rayon, o.x + c.rayon), ys.push(o.y - c.rayon, o.y + c.rayon);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const etendue = Math.max(maxX - minX, maxY - minY, 1e-6);
  const echelle = Math.min((LARGEUR - 2 * MARGE) / Math.max(maxX - minX, 1e-6), (HAUTEUR_MAX - 2 * MARGE) / Math.max(maxY - minY, 1e-6), (LARGEUR - 2 * MARGE) / etendue * 4);
  const hauteur = Math.max(140, (maxY - minY) * echelle + 2 * MARGE);
  const decalageX = (LARGEUR - (maxX - minX) * echelle) / 2;
  const P = (p: Pt) => ({ x: decalageX + (p.x - minX) * echelle, y: hauteur - MARGE - (p.y - minY) * echelle });
  const ecran = (nom: string) => P(parNom.get(nom)!);

  // Centre de gravité : les noms de points et les longueurs sont écrits « vers l'extérieur ».
  const centre = P({ x: figure.points.reduce((s, p) => s + p.x, 0) / figure.points.length, y: figure.points.reduce((s, p) => s + p.y, 0) / figure.points.length });
  const versExterieur = (q: Pt, distance: number): Pt => {
    const dx = q.x - centre.x;
    const dy = q.y - centre.y;
    const n = Math.hypot(dx, dy) || 1;
    return { x: q.x + (dx / n) * distance, y: q.y + (dy / n) * distance };
  };

  return (
    <svg viewBox={`0 0 ${LARGEUR} ${hauteur}`} role="img" aria-label="Figure de géométrie" className="w-full h-auto" fontFamily={POLICE}>
      {figure.cercles.map((c, i) => {
        const o = ecran(c.centre);
        return <circle key={`c${i}`} cx={o.x} cy={o.y} r={c.rayon * echelle} fill="none" stroke={COULEURS.principale} strokeWidth={1.6} />;
      })}

      {figure.droites.map((d, i) => {
        const a = ecran(d.par[0]);
        const b = ecran(d.par[1]);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const n = Math.hypot(dx, dy) || 1;
        const k = LARGEUR * 2; // prolongée au-delà du cadre (le SVG découpe)
        return (
          <g key={`d${i}`}>
            <line x1={a.x - (dx / n) * k} y1={a.y - (dy / n) * k} x2={a.x + (dx / n) * k} y2={a.y + (dy / n) * k} stroke={COULEURS.encreDouce} strokeWidth={1.2} />
            {d.nom && (
              <Etiquette x={b.x + (dx / n) * 26} y={b.y + (dy / n) * 26 - 8} taille={12} couleur={COULEURS.encreDouce} gras>
                {d.nom}
              </Etiquette>
            )}
          </g>
        );
      })}

      {figure.segments.map((s, i) => {
        const a = ecran(s.de);
        const b = ecran(s.a);
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const n = Math.hypot(dx, dy) || 1;
        const u = { x: dx / n, y: dy / n }; // direction
        const v = { x: -u.y, y: u.x }; // normale
        // Côté de la normale opposé au centre de la figure, pour écrire la longueur à l'extérieur.
        const signe = (m.x - centre.x) * v.x + (m.y - centre.y) * v.y >= 0 ? 1 : -1;
        return (
          <g key={`s${i}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={COULEURS.encre} strokeWidth={1.8} strokeDasharray={s.pointille ? "6 4" : undefined} />
            {s.codage &&
              Array.from({ length: s.codage }, (_, k) => {
                const decal = (k - (s.codage! - 1) / 2) * 5;
                const c = { x: m.x + u.x * decal, y: m.y + u.y * decal };
                return <line key={k} x1={c.x - v.x * 6} y1={c.y - v.y * 6} x2={c.x + v.x * 6} y2={c.y + v.y * 6} stroke={COULEURS.encre} strokeWidth={1.4} />;
              })}
            {s.parallele &&
              Array.from({ length: s.parallele }, (_, k) => {
                // Chevrons « > » au milieu du segment, orientés dans le sens du segment.
                const c = { x: m.x + u.x * (k * 7 - (s.parallele! - 1) * 3.5), y: m.y + u.y * (k * 7 - (s.parallele! - 1) * 3.5) };
                const p1 = { x: c.x - u.x * 5 + v.x * 5, y: c.y - u.y * 5 + v.y * 5 };
                const p2 = { x: c.x - u.x * 5 - v.x * 5, y: c.y - u.y * 5 - v.y * 5 };
                return <polyline key={k} points={`${p1.x},${p1.y} ${c.x},${c.y} ${p2.x},${p2.y}`} fill="none" stroke={COULEURS.principale} strokeWidth={1.6} />;
              })}
            {s.longueur && (
              <Etiquette x={m.x + v.x * 14 * signe} y={m.y + v.y * 14 * signe} taille={14} couleur={COULEURS.principaleProfonde} gras>
                {s.longueur}
              </Etiquette>
            )}
          </g>
        );
      })}

      {figure.angles.map((ang, i) => {
        const o = ecran(ang.sommet);
        const a = ecran(ang.de);
        const b = ecran(ang.a);
        const ua = unitaire(o, a);
        const ub = unitaire(o, b);
        if (ang.droit) {
          const t = 11;
          const p1 = { x: o.x + ua.x * t, y: o.y + ua.y * t };
          const p3 = { x: o.x + ub.x * t, y: o.y + ub.y * t };
          const p2 = { x: p1.x + ub.x * t, y: p1.y + ub.y * t };
          return <polyline key={`a${i}`} points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`} fill="none" stroke={COULEURS.encre} strokeWidth={1.3} />;
        }
        const r = 20;
        const debut = { x: o.x + ua.x * r, y: o.y + ua.y * r };
        const fin = { x: o.x + ub.x * r, y: o.y + ub.y * r };
        // Petit arc (≤ 180°) : sens choisi d'après le produit vectoriel.
        const balayage = ua.x * ub.y - ua.y * ub.x > 0 ? 1 : 0;
        const bissectrice = unitaire({ x: 0, y: 0 }, { x: ua.x + ub.x, y: ua.y + ub.y });
        return (
          <g key={`a${i}`}>
            <path d={`M${debut.x},${debut.y} A${r},${r} 0 0 ${balayage} ${fin.x},${fin.y}`} fill="none" stroke={COULEURS.alerte} strokeWidth={1.4} />
            {ang.valeur && (
              <Etiquette x={o.x + bissectrice.x * (r + 13)} y={o.y + bissectrice.y * (r + 13)} taille={11} couleur={COULEURS.alerte} gras>
                {ang.valeur}
              </Etiquette>
            )}
          </g>
        );
      })}

      {figure.points
        .filter((p) => !p.cache)
        .map((p) => {
          const q = P(p);
          const etiquette = versExterieur(q, 14);
          return (
            <g key={p.nom}>
              <circle cx={q.x} cy={q.y} r={2.6} fill={COULEURS.encre} />
              <Etiquette x={etiquette.x} y={etiquette.y} taille={15} gras>
                {p.nom}
              </Etiquette>
            </g>
          );
        })}
    </svg>
  );
}

function unitaire(de: Pt, a: Pt): Pt {
  const dx = a.x - de.x;
  const dy = a.y - de.y;
  const n = Math.hypot(dx, dy) || 1;
  return { x: dx / n, y: dy / n };
}
