import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { ReformulateQuestionInput } from "../schemas/reformulate-question.js";

export function buildReformulateQuestionPrompt(input: ReformulateQuestionInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Tu reformules une question QCM que l'élève vient d'échouer, pour qu'il la retente. La nouvelle version doit tester exactement la même notion et le même niveau de difficulté, mais changer l'angle : autres valeurs numériques, autre exemple concret, ordre des choix mélangé, formulation différente. Ne jamais renvoyer une question identique ou juste réordonnée superficiellement.

Format de sortie JSON attendu :
{ "enonce": string, "choix": string[] (exactement 4 choix), "bonneReponse": string (identique à l'un des choix) }`;

  const prompt = `Notion testée : ${input.notionNom}

Question originale : ${input.enonceOriginal}
Choix originaux : ${input.choixOriginal.join(" / ")}
Bonne réponse originale : ${input.bonneReponseOriginal}

Reformule cette question.`;

  return { system, prompt };
}
