import { Card, MathText } from "../../design-system";
import { EXEMPLES_MATHS } from "../../lib/math-exemples";

/** Page interne de contrôle du rendu mathématique (KaTeX + rétrocompatibilité Unicode). */
export function DemoMathsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-extrabold text-xl text-ink">Démo — affichage mathématique</h1>
        <p className="text-sm text-ink-soft mt-1">
          Les formules simples restent en Unicode ; les formules structurées s'écrivent en LaTeX entre $…$ (en ligne)
          ou $$…$$ (bloc). Un texte sans délimiteur s'affiche comme avant.
        </p>
      </div>
      {EXEMPLES_MATHS.map((ex) => (
        <Card key={ex.titre}>
          <div className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-2">{ex.titre}</div>
          <div className="text-[15px] text-ink mb-3">
            <MathText text={ex.texte} />
          </div>
          <pre className="text-[11px] text-ink-soft bg-bg rounded-[10px] p-2 whitespace-pre-wrap break-all">{ex.texte}</pre>
        </Card>
      ))}
    </div>
  );
}
