import { useId, useMemo } from "react";
import { validerFigure } from "@kalyaro/shared";
import { Arbre } from "./Arbre";
import { Diagramme } from "./Diagrammes";
import { Geometrie } from "./Geometrie";
import { Repere, type InteractionRepere } from "./Repere";

export type { InteractionRepere };
import { TableauSignes, TableauVariations } from "./Tableaux";

/**
 * Dessine une figure décrite en JSON (repère, tableau, diagramme, arbre, géométrie). La figure
 * est revalidée ici : si elle est invalide (donnée ancienne, saisie manuelle…), on affiche un
 * message plutôt qu'un dessin faux. `afficherErreurs` détaille les erreurs (écrans admin).
 */
export function FigureRenderer({
  figure,
  afficherErreurs = false,
  interaction,
}: {
  figure: unknown;
  afficherErreurs?: boolean;
  /** Réponse « placer un point » (repère uniquement). */
  interaction?: InteractionRepere;
}) {
  const id = useId().replace(/:/g, "");
  const resultat = useMemo(() => validerFigure(figure), [figure]);

  if (!resultat.ok) {
    return (
      <div className="rounded-[12px] border-2 border-dashed border-line bg-bg p-3 text-sm text-ink-soft" role="note">
        Figure indisponible.
        {afficherErreurs && (
          <ul className="mt-1 list-disc list-inside text-xs text-alert">
            {resultat.erreurs.slice(0, 6).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const f = resultat.figure;
  const dessin = (() => {
    switch (f.type) {
      case "repere":
        return <Repere figure={f} id={id} interaction={interaction} />;
      case "tableau_variations":
        return <TableauVariations figure={f} id={id} />;
      case "tableau_signes":
        return <TableauSignes figure={f} />;
      case "diagramme_statistique":
        return <Diagramme figure={f} />;
      case "arbre_probabilites":
        return <Arbre figure={f} />;
      case "geometrie_plane":
        return <Geometrie figure={f} />;
    }
  })();
  return <figure className="my-3 mx-auto max-w-[480px] bg-surface rounded-[12px]">{dessin}</figure>;
}
