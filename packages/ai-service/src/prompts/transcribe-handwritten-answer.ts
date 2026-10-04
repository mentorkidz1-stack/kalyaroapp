import { BASE_SYSTEM_INSTRUCTIONS, consignePublic } from "./shared.js";
import type { TranscribeHandwrittenAnswerInput } from "../schemas/transcribe-handwritten-answer.js";

export function buildTranscribeHandwrittenAnswerPrompt(input: TranscribeHandwrittenAnswerInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}
${consignePublic(input.parcours)}

Tu transcris la copie manuscrite d'un étudiant à partir de photos, pour qu'elle soit ensuite corrigée. Tu n'es PAS le correcteur.
- Transcris FIDÈLEMENT ce qui est écrit, y compris les erreurs de calcul, de signe ou de raisonnement : ne corrige rien, ne complète rien, n'ajoute aucune étape absente de la copie.
- Conserve l'ordre et la structure (lignes de calcul, flèches, « donc », conclusions encadrées).
- Écris les mathématiques comme demandé plus haut (Unicode pour le simple, LaTeX entre $…$ pour le structuré) ; un mot ou symbole illisible devient [illisible].
- Rattache chaque partie de la copie au numéro de question correspondant (l'étudiant écrit souvent « 1) », « 2.a », « Q3 »…) ; si la copie ne porte pas de numéro et qu'une seule question est demandée, tout lui appartient. N'invente pas de réponse pour une question absente de la copie : omets-la.
- "lisible" vaut false seulement si les photos sont globalement inexploitables (floues, trop sombres, coupées) ; dans ce cas, explique dans "remarque" comment reprendre la photo.

Format de sortie JSON attendu :
{ "lisible": boolean, "questions": [ { "numero": string, "transcription": string } ], "remarque": string | null }`;

  const questions = input.questions.map((q) => `- Question ${q.numero} : ${q.enonce}`).join("\n");
  const prompt = `Questions de l'épreuve :
${questions}

Les photos de la copie sont jointes (dans l'ordre des pages). Transcris-les.`;

  return { system, prompt };
}
