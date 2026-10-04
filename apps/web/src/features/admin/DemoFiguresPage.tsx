import { EXEMPLES_FIGURES, EXEMPLE_FIGURE_INVALIDE } from "@kalyaro/shared";
import { Card, FigureRenderer } from "../../design-system";

/** Page interne de contrôle des figures dessinées par l'application (chantier 2.3). */
export function DemoFiguresPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-extrabold text-xl text-ink">Démo — figures mathématiques</h1>
        <p className="text-sm text-ink-soft mt-1">
          L'IA ne dessine jamais : elle décrit la figure en JSON (validé par un schéma), et l'application la trace
          exactement. Une description incohérente est refusée, jamais affichée de travers.
        </p>
      </div>
      {EXEMPLES_FIGURES.map((ex) => (
        <Card key={ex.titre}>
          <div className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-1">{ex.titre}</div>
          <FigureRenderer figure={ex.figure} afficherErreurs />
          <details>
            <summary className="text-xs text-ink-soft cursor-pointer">Description JSON</summary>
            <pre className="text-[11px] text-ink-soft bg-bg rounded-[10px] p-2 whitespace-pre-wrap break-all">
              {JSON.stringify(ex.figure, null, 2)}
            </pre>
          </details>
        </Card>
      ))}
      <Card className="border-alert">
        <div className="font-mono text-[11px] uppercase tracking-wide text-alert mb-1">
          Figure invalide (dérivée positive mais fonction décroissante) : refusée
        </div>
        <FigureRenderer figure={EXEMPLE_FIGURE_INVALIDE} afficherErreurs />
      </Card>
    </div>
  );
}
