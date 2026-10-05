import type { ButtonHTMLAttributes } from "react";

type ChoiceState = "default" | "selected" | "correct" | "wrong";

interface ChoiceButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  state?: ChoiceState;
}

const stateClasses: Record<ChoiceState, string> = {
  default: "border-line bg-white hover:border-primary",
  /** Choisi, pas encore validé (l'élève déclare d'abord sa confiance). */
  selected: "border-primary bg-white text-primary-deep shadow-[0_0_0_3px_rgba(27,122,92,0.2)]",
  correct: "border-primary bg-primary-tint text-primary-deep pop-in",
  wrong: "border-alert bg-alert-tint text-alert shake-once",
};

export function ChoiceButton({ state = "default", className = "", ...props }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      className={`block w-full text-left px-4 py-[14px] rounded-[14px] border-2 font-sans font-bold text-sm mb-[10px] transition-colors disabled:cursor-not-allowed ${stateClasses[state]} ${className}`}
      {...props}
    />
  );
}
