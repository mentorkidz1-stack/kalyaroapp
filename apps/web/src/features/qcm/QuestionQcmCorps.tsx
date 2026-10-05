import { useState } from "react";
import { encoderPoint, lireNombre } from "@kalyaro/shared";
import { ChoiceButton, ChoixConfiance, FigureRenderer, MathText, fieldInputClass, type Confiance } from "../../design-system";
import { formatNombre } from "../../design-system/figures/outils";
import type { NextQcm } from "./useQcm";

/**
 * Corps d'une question QCM, commun au parcours, aux révisions et au sondage de prérequis :
 * figure + choix, ou réponse donnée SUR la figure (placer un point, lire une valeur).
 * L'élève choisit sa réponse, puis valide en déclarant sa confiance (chantier 3.1).
 * Le parent garde l'envoi et le verdict ; il change la `key` à chaque nouvelle question.
 * Comme pour les choix, une erreur ne dévoile pas la bonne réponse : l'indice IA guide.
 */
export function QuestionQcmCorps({
  question,
  correcte,
  disabled,
  onRepondre,
}: {
  question: NextQcm;
  correcte: boolean | null;
  disabled: boolean;
  onRepondre: (reponse: string, confiance: Confiance) => void;
}) {
  const type = question.typeReponse ?? "CHOIX";
  const props = { question, correcte, disabled, onRepondre };
  if (type === "PLACER_POINT") return <PlacerPoint {...props} />;
  if (type === "LIRE_VALEUR") return <LireValeur {...props} />;
  return <Choix {...props} />;
}

type PropsReponse = {
  question: NextQcm;
  correcte: boolean | null;
  disabled: boolean;
  onRepondre: (reponse: string, confiance: Confiance) => void;
};

/** Validation par la confiance : visible tant que la réponse n'est pas corrigée. */
function Validation({
  pret,
  correcte,
  disabled,
  envoyer,
}: {
  pret: boolean;
  correcte: boolean | null;
  disabled: boolean;
  envoyer: (confiance: Confiance) => void;
}) {
  const [choisie, setChoisie] = useState<Confiance | null>(null);
  if (correcte !== null || !pret) return null;
  return (
    <ChoixConfiance
      disabled={disabled}
      enCours={disabled ? choisie : null}
      onChoix={(c) => {
        setChoisie(c);
        envoyer(c);
      }}
    />
  );
}

function Choix({ question, correcte, disabled, onRepondre }: PropsReponse) {
  const [choisi, setChoisi] = useState<string | null>(null);
  const fige = disabled || correcte !== null;
  return (
    <>
      {question.figure != null && <FigureRenderer figure={question.figure} />}
      {question.choix.map((choix) => {
        const state =
          choisi !== choix ? "default" : correcte === null ? "selected" : correcte ? "correct" : "wrong";
        return (
          <ChoiceButton key={choix} state={state} disabled={fige} aria-pressed={choisi === choix} onClick={() => setChoisi(choix)}>
            <MathText text={choix} />
          </ChoiceButton>
        );
      })}
      <Validation pret={choisi !== null} correcte={correcte} disabled={disabled} envoyer={(c) => choisi && onRepondre(choisi, c)} />
    </>
  );
}

function PlacerPoint({ question, correcte, disabled, onRepondre }: PropsReponse) {
  const [point, setPoint] = useState<[number, number] | null>(null);
  const fige = disabled || correcte !== null;

  return (
    <>
      <p className="text-xs text-ink-soft mb-1">Touche le repère pour placer ton point (tu peux le déplacer avant de valider).</p>
      <FigureRenderer
        figure={question.figure}
        interaction={{
          point,
          onPlacer: (x, y) => setPoint([x, y]),
          pasGrille: question.interaction?.pasGrille ?? null,
          desactive: fige,
          correct: correcte,
        }}
      />
      <p className="text-sm text-ink text-center mb-3" aria-live="polite">
        {point ? (
          <>
            Ton point : <strong>({formatNombre(point[0])} ; {formatNombre(point[1])})</strong>
          </>
        ) : (
          "Aucun point placé pour l'instant."
        )}
      </p>
      <Validation
        pret={point !== null}
        correcte={correcte}
        disabled={disabled}
        envoyer={(c) => point && onRepondre(encoderPoint(point[0], point[1]), c)}
      />
    </>
  );
}

function LireValeur({ question, correcte, disabled, onRepondre }: PropsReponse) {
  const [saisie, setSaisie] = useState("");
  const fige = disabled || correcte !== null;
  const unite = question.interaction?.unite;
  const lisible = lireNombre(saisie) !== null;

  const bordure = correcte === true ? "border-primary bg-primary-tint" : correcte === false ? "border-alert bg-alert-tint" : "";
  return (
    <>
      {question.figure != null && <FigureRenderer figure={question.figure} />}
      <form className="flex items-center gap-2 mb-3" onSubmit={(e) => e.preventDefault()}>
        <label className="sr-only" htmlFor="valeur-lue">
          Valeur lue sur la figure
        </label>
        <input
          id="valeur-lue"
          className={`${fieldInputClass} text-base ${bordure}`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="Ta lecture, ex. 2,5"
          value={saisie}
          disabled={fige}
          onChange={(e) => setSaisie(e.target.value)}
        />
        {unite && <span className="text-sm text-ink-soft whitespace-nowrap">{unite}</span>}
      </form>
      {saisie.trim() !== "" && !lisible && (
        <p className="text-xs text-alert mb-2">Écris un nombre, par exemple 2,5 ou −3 ou 1/2.</p>
      )}
      <Validation pret={lisible} correcte={correcte} disabled={disabled} envoyer={(c) => onRepondre(saisie.trim(), c)} />
    </>
  );
}
