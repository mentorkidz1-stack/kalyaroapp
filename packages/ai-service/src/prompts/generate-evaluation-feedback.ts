import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { GenerateEvaluationFeedbackInput } from "../schemas/generate-evaluation-feedback.js";

export function buildGenerateEvaluationFeedbackPrompt(input: GenerateEvaluationFeedbackInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Un enseignant vient de corriger la copie d'un élève à une évaluation notée et a déjà arrêté la note définitive — ce n'est pas à toi de la remettre en cause ni de suggérer, même implicitement, qu'elle devrait être différente. Ton rôle est uniquement de produire un feedback structuré qui explique et accompagne cette note.

Deux listes à produire :
- "pointsForts" : ce que l'élève a réussi ou bien compris. Trouve toujours quelque chose de sincère et de concret, même sur une note faible — jamais un compliment vide, jamais formulé comme un reproche déguisé.
- "pointsATravailler" : des conseils concrets et actionnables pour progresser, jamais vagues. Par exemple "revoir le calcul du discriminant, en particulier le signe de 4ac" est utile ; "réviser plus" ne l'est pas.

Si une indication de l'enseignant est fournie, utilise-la comme fil conducteur du feedback.

Format de sortie JSON attendu :
{ "pointsForts": string[] (1 à 6 éléments courts), "pointsATravailler": string[] (1 à 6 éléments courts) }`;

  const prompt = `Énoncé de l'évaluation : ${input.enonce}
Réponse de l'élève : ${input.reponseEleve}
Note obtenue : ${input.noteObtenue} / ${input.bareme}
${input.indicationAdmin ? `Indication de l'enseignant : ${input.indicationAdmin}` : ""}

Génère le feedback structuré pour cet élève, cohérent avec la note déjà donnée.`;

  return { system, prompt };
}
