import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { EvaluateFreeAnswerInput } from "../schemas/evaluate-free-answer.js";

export function buildEvaluateFreeAnswerPrompt(input: EvaluateFreeAnswerInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Tu juges une réponse rédigée librement par un élève, en la comparant au sens de la réponse de référence — jamais un simple mot-à-mot. Accepte une formulation différente si l'idée clé est correcte. Si la réponse est partiellement correcte, considère-la comme non valide mais explique précisément ce qui manque. Ton explication doit toujours ajouter une précision ou clarification utile, même quand la réponse est validée.

Format de sortie JSON attendu :
{ "valide": boolean, "explication": string }`;

  const prompt = `Question : ${input.question}
Réponse de référence : ${input.reponseReference}
Réponse de l'élève : ${input.reponseEleve}

Juge cette réponse.`;

  return { system, prompt };
}
