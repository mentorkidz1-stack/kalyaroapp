import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { GenerateQcmVariantsInput } from "../schemas/generate-qcm-variants.js";

export function buildGenerateQcmVariantsPrompt(input: GenerateQcmVariantsInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Tu crées des variantes d'une question QCM existante. Elles seront relues par un enseignant avant d'être proposées à un étudiant qui vient de rater la question d'origine : chaque variante doit tester exactement la même notion, avec la même méthode et le même niveau de difficulté, mais sans pouvoir être résolue en recopiant la réponse d'origine.

Pour chaque variante :
- change les valeurs numériques et/ou le contexte concret (de préférence ancré dans la vie au Bénin), et reformule l'énoncé ;
- recalcule la bonne réponse avec soin, étape par étape, à partir des NOUVELLES valeurs : une erreur de corrigé est le pire défaut possible ;
- propose exactement 4 choix tous différents, dont 3 distracteurs plausibles qui correspondent à des erreurs fréquentes (erreur de signe, oubli d'un terme, confusion de formule…) ;
- les choix emploient exactement les mêmes notations que TON énoncé : si tu renommes la variable (x au lieu de q, B(q) au lieu de π(q)), renomme-la aussi dans les choix ;
- "bonneReponse" doit être recopiée caractère pour caractère depuis l'un des 4 choix ;
- les variantes doivent être différentes entre elles.

Format de sortie JSON attendu :
{ "variantes": [ { "enonce": string, "choix": string[] (exactement 4), "bonneReponse": string } ] }`;

  const prompt = `Notion testée : ${input.notionNom}

Question d'origine : ${input.enonceOriginal}
Choix d'origine : ${input.choixOriginal.join(" / ")}
Bonne réponse d'origine : ${input.bonneReponseOriginal}

Génère ${input.nombreVariantes} variante(s) de cette question.`;

  return { system, prompt };
}
