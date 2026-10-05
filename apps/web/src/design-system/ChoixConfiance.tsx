export type Confiance = "SUR" | "HESITE" | "HASARD";

const OPTIONS: { valeur: Confiance; libelle: string; icone: string }[] = [
  { valeur: "SUR", libelle: "Sûr", icone: "💪" },
  { valeur: "HESITE", libelle: "J'hésite", icone: "🤔" },
  { valeur: "HASARD", libelle: "Au hasard", icone: "🎲" },
];

/**
 * « Ta confiance ? » : trois boutons qui valident la réponse en même temps (chantier 3.1).
 * Déclarer sa confiance avant de voir le résultat apprend à repérer ce qu'on croit savoir.
 */
export function ChoixConfiance({
  onChoix,
  disabled = false,
  enCours = null,
}: {
  onChoix: (confiance: Confiance) => void;
  disabled?: boolean;
  /** Confiance choisie pendant l'envoi : son bouton reste marqué. */
  enCours?: Confiance | null;
}) {
  return (
    <div className="mt-1 mb-2 fade-in" role="group" aria-label="Ta confiance dans cette réponse">
      <p className="text-sm font-semibold text-ink mb-2">Avant de valider : tu es…</p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.valeur}
            type="button"
            disabled={disabled}
            onClick={() => onChoix(o.valeur)}
            className={`flex flex-col items-center gap-0.5 rounded-[14px] border-2 px-2 py-2.5 font-sans font-bold text-sm transition-colors disabled:cursor-not-allowed ${
              enCours === o.valeur ? "border-primary bg-primary-tint text-primary-deep" : "border-line bg-white hover:border-primary disabled:opacity-50"
            }`}
          >
            <span aria-hidden className="text-lg leading-none">
              {o.icone}
            </span>
            {o.libelle}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Message après correction, selon la confiance déclarée ; null s'il n'y a rien de spécial à dire. */
export function messageConfiance(r: { erreurAssuree?: boolean; reussiteAuHasard?: boolean }): string | null {
  if (r.erreurAssuree) {
    return "Tu étais sûr — c'est l'erreur la plus importante à corriger. Cette notion passe en tête de tes révisions.";
  }
  if (r.reussiteAuHasard) {
    return "Bonne réponse, mais trouvée au hasard : elle ne compte pas pour ta maîtrise. Prends le temps de comprendre pourquoi c'est juste.";
  }
  return null;
}
