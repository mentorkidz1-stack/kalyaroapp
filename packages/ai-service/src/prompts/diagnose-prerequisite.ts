import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { DiagnosePrerequisiteInput } from "../schemas/diagnose-prerequisite.js";

export function buildDiagnosePrerequisitePrompt(input: DiagnosePrerequisiteInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Un élève vient d'échouer sur une notion, dans le cadre d'une épreuve. Ta tâche : identifier, parmi la liste des prérequis directs de cette notion, celui qui est le plus probablement à l'origine de l'échec, en te basant sur la nature de l'erreur commise. Choisis un seul prérequis, celui dont le nom correspond exactement à l'un de ceux fournis.

Format de sortie JSON attendu :
{ "prerequisSuspecte": string (doit être exactement l'un des noms de prérequis fournis), "justification": string }`;

  const prereqList = input.prerequisDirects
    .map((p) => `- ${p.nom} : ${p.description}`)
    .join("\n");

  const prompt = `Notion en échec : ${input.notionEnEchecNom} (${input.notionEnEchecDescription})

Prérequis directs possibles :
${prereqList}

Contexte de l'échec : ${input.contexteEchec}
Réponse donnée par l'élève : ${input.reponseEleve}

Identifie le prérequis le plus probablement en cause.`;

  return { system, prompt };
}
