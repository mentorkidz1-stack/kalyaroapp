import type { RefObject } from "react";

/** Symboles introuvables (ou cachés) sur un clavier de téléphone, dans l'ordre d'usage. */
const SYMBOLES = ["²", "³", "√", "π", "Δ", "−", "×", "÷", "≤", "≥", "≠", "≈", "→", "⇔", "∞", "ℝ", "∈", "σ", "x̄", "q*"];

/** Insère un texte à la position du curseur d'une zone de texte et renvoie la nouvelle valeur. */
export function insererAuCurseur(zone: HTMLTextAreaElement, texte: string): { valeur: string; curseur: number } {
  const debut = zone.selectionStart ?? zone.value.length;
  const fin = zone.selectionEnd ?? zone.value.length;
  return { valeur: zone.value.slice(0, debut) + texte + zone.value.slice(fin), curseur: debut + texte.length };
}

/**
 * Barre de symboles mathématiques au-dessus du clavier du téléphone. Le focus reste dans la
 * zone de texte : le clavier ne se ferme pas à chaque symbole.
 */
export function ClavierMaths({
  zone,
  onInsertion,
  desactive,
}: {
  zone: RefObject<HTMLTextAreaElement>;
  onInsertion: (valeur: string) => void;
  desactive?: boolean;
}) {
  function inserer(symbole: string) {
    const el = zone.current;
    if (!el || desactive) return;
    const { valeur, curseur } = insererAuCurseur(el, symbole);
    onInsertion(valeur);
    // Après le rendu React, on replace le curseur juste après le symbole inséré.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(curseur, curseur);
    });
  }

  return (
    <div className="mb-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="toolbar" aria-label="Symboles mathématiques">
        {SYMBOLES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={desactive}
            // Empêcher le changement de focus garde le clavier du téléphone ouvert ; l'insertion
            // se fait au seul « click » (un seul déclenchement, au doigt comme à la souris).
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => inserer(s)}
            className="shrink-0 min-w-[40px] h-10 px-2 rounded-[10px] border-2 border-line bg-surface text-[17px] text-ink active:bg-primary-tint disabled:opacity-40"
            aria-label={`Insérer ${s}`}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-ink-soft mt-1">
        Pas de souci de notation : x^2, racine(…), * ou / sont acceptés et ne coûtent aucun point.
      </p>
    </div>
  );
}
