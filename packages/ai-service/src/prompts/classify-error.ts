import { BASE_SYSTEM_INSTRUCTIONS, consignePublic } from "./shared.js";
import type { ClassifyErrorInput } from "../schemas/classify-error.js";

export function buildClassifyErrorPrompt(input: ClassifyErrorInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

${consignePublic(input.parcours)}

Un élève vient de se tromper. Ton rôle est de classer la CAUSE la plus probable de son erreur dans exactement une de ces catégories, pour alimenter son cahier d'erreurs :
- CONNAISSANCE : il ne connaît pas (ou plus) la définition, la formule ou la propriété nécessaire.
- CONFUSION : il confond deux notions, deux formules ou deux définitions voisines (ex. moyenne et médiane, dérivée et primitive).
- PROCEDURE : il connaît la notion mais applique mal les étapes d'une technique (ordre des étapes, étape oubliée).
- LECTURE_ENONCE : il a mal lu ou mal compris la consigne (répond à une autre question, oublie une donnée, ignore une condition).
- CALCUL : le raisonnement est bon mais une erreur de calcul ou de signe fausse le résultat.
- METHODE : il choisit une stratégie inadaptée au problème (mauvais outil, mauvaise approche).
- REDACTION : le fond est juste mais la justification, la rigueur ou la présentation sont insuffisantes (réponses rédigées uniquement).

Choisis la catégorie la mieux étayée par la réponse de l'élève ; en cas de doute entre plusieurs, préfère la plus précise (CALCUL ou LECTURE_ENONCE plutôt que CONNAISSANCE quand les indices le montrent). Pour un QCM, déduis la cause du distracteur choisi. Puis écris UNE phrase courte, adressée à l'élève (tutoiement), qui explique ce qui dans sa réponse révèle ce type d'erreur — sans donner la bonne réponse.

Format de sortie JSON attendu :
{ "typeErreur": "CONNAISSANCE" | "CONFUSION" | "PROCEDURE" | "LECTURE_ENONCE" | "CALCUL" | "METHODE" | "REDACTION", "explication": string }`;

  const choix = input.choix?.length ? `\nChoix proposés : ${input.choix.join(" / ")}` : "";
  const prompt = `Notion : ${input.notionNom}
Format : ${input.format === "QCM" ? "question à choix (ou réponse sur une figure)" : "réponse rédigée"}
Question : ${input.question}${choix}
Réponse attendue (pour toi seulement) : ${input.reponseAttendue}
Réponse de l'élève (fausse) : ${input.reponseEleve}

Classe la cause de cette erreur.`;

  return { system, prompt };
}
