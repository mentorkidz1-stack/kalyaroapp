const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};

/** Convertit une notation d'exposant en caret ("x^2") en Unicode superscript ("x²"),
 * pour le contenu généré par l'IA qui n'a pas toujours respecté la consigne de notation. */
export function formatMathText(text: string): string {
  return text.replace(/\^(-?\d+)/g, (_match, exponent: string) =>
    exponent
      .split("")
      .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
      .join("")
  );
}
