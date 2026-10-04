import { useEffect, useRef, useState } from "react";
import { EXEMPLES_FIGURES, validerFigure } from "@kalyaro/shared";
import { FigureRenderer, fieldInputClass } from "../../design-system";

/**
 * Édition d'une figure par l'admin : description JSON, aperçu immédiat, erreurs du schéma.
 * `onChange(figure, valide)` : figure = objet JSON (null si vide) ; une figure invalide est
 * signalée (valide = false) pour bloquer l'enregistrement — l'API la refuserait de toute façon.
 */
export function EditeurFigure({
  valeur,
  onChange,
}: {
  valeur: unknown;
  onChange: (figure: unknown | null, valide: boolean) => void;
}) {
  const [ouvert, setOuvert] = useState(valeur != null);
  const [texte, setTexte] = useState(valeur != null ? JSON.stringify(valeur, null, 2) : "");
  const [erreurJson, setErreurJson] = useState<string | null>(null);
  // Dernière valeur émise : quand le parent nous la renvoie, on ne reformate pas le texte
  // (sinon le curseur sauterait à chaque frappe). Seul un changement externe resynchronise.
  const dernierEmis = useRef<unknown>(valeur);

  useEffect(() => {
    if (valeur === dernierEmis.current) return;
    dernierEmis.current = valeur;
    setTexte(valeur != null ? JSON.stringify(valeur, null, 2) : "");
    if (valeur != null) setOuvert(true);
  }, [valeur]);

  function emettre(figure: unknown | null, valide: boolean) {
    dernierEmis.current = figure;
    onChange(figure, valide);
  }

  function surSaisie(t: string) {
    setTexte(t);
    if (!t.trim()) {
      setErreurJson(null);
      emettre(null, true);
      return;
    }
    try {
      const objet = JSON.parse(t);
      setErreurJson(null);
      emettre(objet, validerFigure(objet).ok);
    } catch {
      setErreurJson("JSON mal formé (guillemets, virgules, accolades ?)");
      emettre(null, false);
    }
  }

  let apercu: unknown = null;
  try {
    apercu = texte.trim() ? JSON.parse(texte) : null;
  } catch {
    apercu = null;
  }

  if (!ouvert) {
    return (
      <button type="button" className="text-xs font-mono text-primary-deep underline" onClick={() => setOuvert(true)}>
        + Ajouter une figure
      </button>
    );
  }

  return (
    <div className="border border-line rounded-[10px] p-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-mono text-ink-soft">FIGURE (JSON)</span>
        <select
          className={`${fieldInputClass} w-auto text-xs`}
          value=""
          onChange={(e) => {
            const ex = EXEMPLES_FIGURES[Number(e.target.value)];
            if (ex) surSaisie(JSON.stringify(ex.figure, null, 2));
          }}
        >
          <option value="">Partir d'un exemple…</option>
          {EXEMPLES_FIGURES.map((ex, i) => (
            <option key={ex.titre} value={i}>
              {ex.titre}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="text-xs font-mono text-alert"
          onClick={() => {
            surSaisie("");
            setOuvert(false);
          }}
        >
          Supprimer la figure
        </button>
      </div>
      <textarea
        className={`${fieldInputClass} min-h-[120px] font-mono text-[11px]`}
        value={texte}
        onChange={(e) => surSaisie(e.target.value)}
        spellCheck={false}
        placeholder='{"type": "repere", ...}'
      />
      {erreurJson && <p className="text-xs text-alert">{erreurJson}</p>}
      {apercu != null && <FigureRenderer figure={apercu} afficherErreurs />}
    </div>
  );
}
