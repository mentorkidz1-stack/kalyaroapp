import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { ExplainQcmAnswerInput } from "../schemas/explain-qcm-answer.js";

export function buildExplainQcmAnswerPrompt(input: ExplainQcmAnswerInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Un élève vient de répondre faux à une question (à choix multiples, ou dont la réponse se donne sur une figure : placer un point dans un repère, lire une valeur sur un graphique), pour la première fois sur cette notion. Ton rôle est de lui donner un indice court et pédagogique qui l'aide à comprendre pourquoi son choix est incorrect et quelle erreur de raisonnement ou confusion il a probablement commise — sans jamais révéler ni désigner la bonne réponse, et sans simplement répéter "c'est faux, réessaie". L'élève doit apprendre quelque chose de concret sur son erreur, pas juste être encouragé à retenter. Reste bref (1 à 2 phrases), chaleureux, jamais culpabilisant.

Format de sortie JSON attendu :
{ "indice": string }`;

  const reponse = input.surFigure
    ? `Réponse attendue sous forme de ${input.surFigure.consigne === "PLACER_POINT" ? "point à placer dans le repère (coordonnées)" : "valeur lue sur la figure"}.
Figure montrée à l'élève (description JSON) : ${JSON.stringify(input.surFigure.figure)}`
    : `Choix proposés : ${input.choix.join(" / ")}`;
  const prompt = `Notion testée : ${input.notionNom}
Question : ${input.question}
${reponse}
Réponse donnée par l'élève (incorrecte) : ${input.reponseDonnee}

Donne un indice pédagogique sur cette erreur, sans révéler la bonne réponse.`;

  return { system, prompt };
}
