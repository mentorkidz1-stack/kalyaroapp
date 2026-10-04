// Outils communs aux rendus SVG des figures.

/** Couleurs : variables du thème, pour suivre le design system (et un futur thème sombre). */
export const COULEURS = {
  encre: "var(--ink)",
  encreDouce: "var(--ink-soft)",
  ligne: "var(--line)",
  principale: "var(--primary)",
  principaleProfonde: "var(--primary-deep)",
  accent: "var(--accent)",
  alerte: "var(--alert)",
  fond: "var(--surface)",
};
/** Couleurs successives des courbes/droites d'un même repère. */
export const PALETTE = ["var(--primary)", "var(--alert)", "#2f6fb0", "#8A5A0E", "#7b4bb3"];

/** Largeur logique de toutes les figures (le SVG s'adapte ensuite à l'écran). */
export const LARGEUR = 400;
export const POLICE = "Manrope, system-ui, sans-serif";

/** Pas « rond » (1, 2 ou 5 × 10^k) donnant environ `cible` graduations sur l'étendue. */
export function pasRond(etendue: number, cible = 8): number {
  if (!(etendue > 0)) return 1;
  const brut = etendue / cible;
  const puissance = Math.pow(10, Math.floor(Math.log10(brut)));
  const r = brut / puissance;
  return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * puissance;
}

/** Graduations multiples de `pas` comprises dans [min ; max]. */
export function graduations(min: number, max: number, pas: number): number[] {
  const debut = Math.ceil(min / pas - 1e-9);
  const fin = Math.floor(max / pas + 1e-9);
  const res: number[] = [];
  for (let k = debut; k <= fin && res.length < 200; k++) res.push(Number((k * pas).toPrecision(12)));
  return res;
}

/** Nombre au format français : virgule décimale, signe moins typographique. */
export function formatNombre(v: number): string {
  const arrondi = Number(v.toPrecision(10));
  return arrondi.toLocaleString("fr-FR", { maximumFractionDigits: 4 }).replace("-", "−");
}

/** Définitions SVG réutilisables : pointes de flèche. `id` doit être unique dans la page. */
export function DefsFleches({ id }: { id: string }) {
  return (
    <defs>
      <marker id={`${id}-fleche`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill={COULEURS.encre} />
      </marker>
      <marker id={`${id}-fleche-p`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill={COULEURS.principale} />
      </marker>
    </defs>
  );
}

/** Texte lisible sur n'importe quel fond (contour de la couleur du fond). */
export function Etiquette({
  x,
  y,
  children,
  taille = 13,
  ancre = "middle",
  couleur = COULEURS.encre,
  gras,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  taille?: number;
  ancre?: "start" | "middle" | "end";
  couleur?: string;
  gras?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={taille}
      textAnchor={ancre}
      dominantBaseline="middle"
      fill={couleur}
      fontFamily={POLICE}
      fontWeight={gras ? 700 : 500}
      stroke={COULEURS.fond}
      strokeWidth={3}
      paintOrder="stroke"
    >
      {children}
    </text>
  );
}
