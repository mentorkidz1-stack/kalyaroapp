import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { GenerateMetacognitiveQuestionInput } from "../schemas/generate-metacognitive-question.js";

export function buildGenerateMetacognitiveQuestionPrompt(
  input: GenerateMetacognitiveQuestionInput
) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Tu génères une question métacognitive courte, posée à l'élève juste après une question QCM, pour l'inciter à expliciter son raisonnement (par exemple : "pourquoi as-tu choisi cette réponse ?", "qu'est-ce qui t'a fait hésiter ?"). Une seule question, ouverte, brève.

Format de sortie JSON attendu :
{ "enonce": string }`;

  const prompt = `Question posée à l'élève : ${input.question}
Bonne réponse : ${input.bonneReponse}
Notion testée : ${input.notionNom}

Génère la question métacognitive.`;

  return { system, prompt };
}
