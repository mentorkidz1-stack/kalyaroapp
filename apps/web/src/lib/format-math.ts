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

// Commandes LaTeX de symboles simples que l'IA écrit parfois HORS délimiteurs $…$
// (ex. un choix de QCM « \pi'(q) = 0 ») : affichées en Unicode plutôt qu'en code brut.
const SYMBOLES_LATEX: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", theta: "θ", lambda: "λ",
  mu: "μ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varphi: "φ", omega: "ω",
  Delta: "Δ", Sigma: "Σ", Omega: "Ω", Pi: "Π", Phi: "Φ", Gamma: "Γ", Lambda: "Λ",
  times: "×", div: "÷", cdot: "·", pm: "±", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠",
  approx: "≈", infty: "∞", in: "∈", notin: "∉", subset: "⊂", cup: "∪", cap: "∩", emptyset: "∅",
  Rightarrow: "⇒", Leftrightarrow: "⇔", iff: "⇔", rightarrow: "→", to: "→", forall: "∀", exists: "∃",
  sqrt: "√", ldots: "…", dots: "…", circ: "°", degree: "°",
};

/** Convertit une notation d'exposant en caret ("x^2") en Unicode superscript ("x²"),
 * pour le contenu généré par l'IA qui n'a pas toujours respecté la consigne de notation.
 * Ne s'applique qu'à la prose, jamais à l'intérieur d'une formule LaTeX (voir MathText). */
export function formatMathText(text: string): string {
  return text
    .replace(/\\([A-Za-z]+)(?![A-Za-z])/g, (match, nom: string) => SYMBOLES_LATEX[nom] ?? match)
    .replace(/\^(-?\d+)/g, (_match, exponent: string) =>
      exponent
        .split("")
        .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
        .join("")
    );
}
