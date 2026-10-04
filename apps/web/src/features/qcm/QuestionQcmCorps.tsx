import { useState } from "react";
import { encoderPoint, lireNombre } from "@kalyaro/shared";
import {
  Button,
  ChoiceButton,
  FigureRenderer,
  MathText,
  fieldInputClass,
} from "../../design-system";
import { formatNombre } from "../../design-system/figures/outils";
import type { NextQcm } from "./useQcm";

/**
 * Corps d'une question QCM, commun au parcours, aux révisions et au sondage de prérequis :
 * figure + choix, ou réponse donnée SUR la figure (placer un point, lire une valeur).
 * Le parent garde l'envoi et le verdict ; il change la `key` à chaque nouvelle question.
 * Comme pour les choix, une erreur ne dévoile pas la bonne réponse : l'indice IA guide.
 */
export function QuestionQcmCorps({
  question,
  selected,
  correcte,
  disabled,
  onRepondre,
}: {
  question: NextQcm;
  /** Choix envoyé (QCM à choix) — pour colorer le bouton après correction. */
  selected: string | null;
  correcte: boolean | null;
  disabled: boolean;
  onRepondre: (reponse: string) => void;
}) {
  const type = question.typeReponse ?? "CHOIX";

  if (type === "PLACER_POINT") {
    return (
      <PlacerPoint
        question={question}
        correcte={correcte}
        disabled={disabled}
        onRepondre={onRepondre}
      />
    );
  }
  if (type === "LIRE_VALEUR") {
    return (
      <LireValeur
        question={question}
        correcte={correcte}
        disabled={disabled}
        onRepondre={onRepondre}
      />
    );
  }
  return (
    <>
      {question.figure != null && <FigureRenderer figure={question.figure} />}
      {question.choix.map((choix) => {
        const state =
          correcte !== null && selected === choix
            ? correcte
              ? "correct"
              : "wrong"
            : "default";
        return (
          <ChoiceButton
            key={choix}
            state={state}
            disabled={disabled || correcte !== null}
            onClick={() => onRepondre(choix)}
          >
            <MathText text={choix} />
          </ChoiceButton>
        );
      })}
    </>
  );
}

type PropsInteractif = {
  question: NextQcm;
  correcte: boolean | null;
  disabled: boolean;
  onRepondre: (reponse: string) => void;
};

function PlacerPoint({
  question,
  correcte,
  disabled,
  onRepondre,
}: PropsInteractif) {
  const [point, setPoint] = useState<[number, number] | null>(null);
  const fige = disabled || correcte !== null;

  return (
    <>
      <p className="text-xs text-ink-soft mb-1">
        Touche le repère pour placer ton point (tu peux le déplacer avant de
        valider).
      </p>
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
            Ton point :{" "}
            <strong>
              ({formatNombre(point[0])} ; {formatNombre(point[1])})
            </strong>
          </>
        ) : (
          "Aucun point placé pour l'instant."
        )}
      </p>
      {correcte === null && (
        <Button
          disabled={!point || fige}
          onClick={() => point && onRepondre(encoderPoint(point[0], point[1]))}
        >
          Valider ce point
        </Button>
      )}
    </>
  );
}

function LireValeur({
  question,
  correcte,
  disabled,
  onRepondre,
}: PropsInteractif) {
  const [saisie, setSaisie] = useState("");
  const [illisible, setIllisible] = useState(false);
  const fige = disabled || correcte !== null;
  const unite = question.interaction?.unite;

  function valider() {
    if (lireNombre(saisie) === null) {
      setIllisible(true);
      return;
    }
    setIllisible(false);
    onRepondre(saisie.trim());
  }

  const bordure =
    correcte === true
      ? "border-primary bg-primary-tint"
      : correcte === false
        ? "border-alert bg-alert-tint"
        : "";
  return (
    <>
      {question.figure != null && <FigureRenderer figure={question.figure} />}
      <form
        className="flex items-center gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!fige) valider();
        }}
      >
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
          onChange={(e) => {
            setSaisie(e.target.value);
            setIllisible(false);
          }}
        />
        {unite && (
          <span className="text-sm text-ink-soft whitespace-nowrap">
            {unite}
          </span>
        )}
      </form>
      {illisible && (
        <p className="text-xs text-alert mb-2">
          Écris un nombre, par exemple 2,5 ou −3 ou 1/2.
        </p>
      )}
      {correcte === null && (
        <Button disabled={!saisie.trim() || fige} onClick={valider}>
          Valider
        </Button>
      )}
    </>
  );
}
