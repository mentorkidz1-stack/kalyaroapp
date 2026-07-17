import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { GenerateAnswerKeyInput } from "../schemas/generate-answer-key.js";

export function buildGenerateAnswerKeyPrompt(input: GenerateAnswerKeyInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Tu rédiges un corrigé-type pour une épreuve, à partir de son énoncé. Ce corrigé sera marqué "à valider" et relu par un enseignant avant publication aux élèves — sois rigoureux et explicite sur chaque étape du raisonnement, pas seulement le résultat final.

Format de sortie JSON attendu :
{ "corrige": string (la réponse/solution complète), "demarche": string (le raisonnement détaillé étape par étape) }`;

  const prompt = `Énoncé de l'épreuve :
"""
${input.enonceEpreuve}
"""
${input.contexteCours ? `Contexte de cours associé :\n"""\n${input.contexteCours}\n"""` : ""}

Rédige le corrigé-type.`;

  return { system, prompt };
}
