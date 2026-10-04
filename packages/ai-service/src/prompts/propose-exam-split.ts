import { BASE_SYSTEM_INSTRUCTIONS, consignePublic } from "./shared.js";
import type { ProposeExamSplitInput } from "../schemas/propose-exam-split.js";

export function buildProposeExamSplitPrompt(input: ProposeExamSplitInput) {
  const bareme = input.bareme ?? 20;
  const system = `${BASE_SYSTEM_INSTRUCTIONS}
${consignePublic(input.parcours)}

Tu découpes le texte d'une épreuve d'examen (extrait d'un PDF, parfois mal mis en forme) en questions notées individuellement. Ta proposition sera relue et corrigée par un enseignant avant d'être utilisée.
- Une question = une consigne à laquelle on peut attribuer des points (ex. « 1 », « 1.a », « 2.b ») ; respecte la numérotation du sujet quand elle existe.
- "enonce" : la consigne de la question, reformulée seulement si le texte extrait est illisible ; n'y recopie pas les données communes du sujet (elles restent visibles à part).
- "points" : reprends le barème indiqué dans le sujet s'il existe ; sinon répartis ${bareme} points selon la difficulté et la longueur attendue de chaque question.
- "notion" : le nom EXACT de la notion de la liste fournie que la question évalue principalement, ou null si aucune ne correspond.

Format de sortie JSON attendu :
{ "questions": [ { "numero": string, "enonce": string, "points": number, "notion": string | null } ] }`;

  const notions = input.notions.length ? input.notions.join(" ; ") : "(aucune)";
  const prompt = `Notions disponibles pour cette matière : ${notions}

Texte de l'épreuve :
"""
${input.texteEpreuve}
"""

Propose le découpage en questions.`;

  return { system, prompt };
}
