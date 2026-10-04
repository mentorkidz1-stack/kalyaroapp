import { BASE_SYSTEM_INSTRUCTIONS, consignePublic } from "./shared.js";
import type { GradeExamAnswerInput } from "../schemas/grade-exam-answer.js";

export function buildGradeExamAnswerPrompt(input: GradeExamAnswerInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}
${consignePublic(input.parcours)}

Tu corriges la réponse à UNE question d'épreuve d'examen, notée sur un barème, comme le ferait un correcteur bienveillant mais exigeant :
- compare la réponse aux corrigés validés fournis ; une démarche différente mais correcte et complète vaut autant que celle du corrigé ;
- attribue des points PARTIELS par multiples de 0,25 : la méthode correcte, les étapes intermédiaires justes et le résultat final rapportent chacun une part des points ; une erreur de calcul n'annule pas une méthode juste ;
- ne dépasse jamais le maximum de points de la question ; une réponse vide, hors sujet ou sans aucun élément juste vaut 0 ;
- "elementsReussis" : ce qui rapporte des points (court, concret) ; "elementsManquants" : ce qui en a fait perdre ;
- "explication" : 2 à 4 phrases qui expliquent la note et donnent la clé pour réussir, sans jamais culpabiliser.

Format de sortie JSON attendu :
{ "pointsObtenus": number, "explication": string, "elementsReussis": string[], "elementsManquants": string[] }`;

  const contexte = input.contexteEpreuve
    ? `Sujet complet de l'épreuve (pour le contexte) :\n"""\n${input.contexteEpreuve}\n"""\n\n`
    : "";
  const corriges = input.corriges.map((c, i) => `Corrigé validé ${i + 1} :\n${c}`).join("\n\n");
  const prompt = `${contexte}Question ${input.numero} (notée sur ${input.pointsMax} points) :
${input.enonceQuestion}

${corriges}

Réponse de l'étudiant :
"""
${input.reponseEtudiant}
"""

Note cette réponse.`;

  return { system, prompt };
}
