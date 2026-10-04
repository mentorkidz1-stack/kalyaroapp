import { useEffect, useMemo, useState } from "react";
import { formatMathText } from "../lib/format-math";
import { contientMath, decouperMath } from "../lib/math-segments";

type Katex = typeof import("katex").default;

// KaTeX (~270 Ko + polices) n'est chargé qu'à la première formule rencontrée : la plupart
// des écrans n'en ont pas besoin, et beaucoup d'étudiants sont sur un forfait mobile limité.
let katexCharge: Katex | null = null;
let chargement: Promise<Katex> | null = null;

function chargerKatex(): Promise<Katex> {
  chargement ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(([mod]) => {
    katexCharge = mod.default;
    return katexCharge;
  });
  return chargement;
}

function rendre(katex: Katex, tex: string, bloc: boolean): string | null {
  try {
    return katex.renderToString(tex, { displayMode: bloc, throwOnError: true, strict: false, output: "htmlAndMathml" });
  } catch {
    return null; // formule invalide : on affiche le source plutôt qu'un rendu cassé
  }
}

/**
 * Affiche un texte mêlant prose et formules : $…$ en ligne, $$…$$ en bloc. La prose garde
 * la conversion Unicode historique (x^2 → x²) ; un texte sans délimiteur s'affiche donc
 * exactement comme avec formatMathText.
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => decouperMath(text), [text]);
  const aDesFormules = contientMath(segments);
  const [katex, setKatex] = useState<Katex | null>(katexCharge);

  useEffect(() => {
    if (!aDesFormules || katex) return;
    let actif = true;
    chargerKatex()
      .then((k) => actif && setKatex(() => k))
      .catch(() => {
        // Hors ligne ou échec réseau : les formules restent affichées en source lisible.
      });
    return () => {
      actif = false;
    };
  }, [aDesFormules, katex]);

  return (
    <span className={className}>
      {segments.map((s, i) => {
        if (s.type === "texte") return <span key={i}>{formatMathText(s.contenu)}</span>;
        const bloc = s.type === "bloc";
        const html = katex ? rendre(katex, s.tex, bloc) : null;
        if (html) {
          return (
            <span
              key={i}
              className={bloc ? "block my-2 overflow-x-auto overflow-y-hidden" : "inline-block max-w-full align-middle"}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return (
          <span key={i} className={`font-mono text-[0.95em] ${bloc ? "block my-2" : ""}`}>
            {bloc ? `$$${s.tex}$$` : `$${s.tex}$`}
          </span>
        );
      })}
    </span>
  );
}
