import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { GenerateQcmInput } from "../schemas/generate-qcm.js";

export function buildGenerateQcmPrompt(input: GenerateQcmInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Tu génères des questions à choix multiples (QCM) à partir d'un extrait de cours, pour tester la compréhension d'une notion précise à la fois — jamais plusieurs notions mélangées dans une même question. Chaque question doit taguer la notion principale qu'elle teste : réutilise un nom de la liste "notions déjà identifiées" si la question correspond exactement, sinon propose un nom de notion court et clair (2-5 mots).

Format de sortie JSON attendu :
{ "questions": [ { "enonce": string, "choix": string[] (exactement 4 choix), "bonneReponse": string (doit être identique à l'un des choix), "notionTag": string, "difficulte": "FACILE"|"MOYEN"|"DIFFICILE" } ] }`;

  const prompt = `Chapitre : ${input.chapitreTitre}
Notions déjà identifiées pour ce chapitre : ${
    input.notionsExistantes.length ? input.notionsExistantes.join(", ") : "(aucune pour l'instant)"
  }

Extrait de cours :
"""
${input.texteCours}
"""

Génère ${input.nombreQuestions} questions QCM distinctes couvrant différentes notions du texte.`;

  return { system, prompt };
}
