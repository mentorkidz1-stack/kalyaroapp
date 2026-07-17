import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { GenerateSummarySheetInput } from "../schemas/generate-summary-sheet.js";

export function buildGenerateSummarySheetPrompt(input: GenerateSummarySheetInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Tu rédiges une fiche résumé ciblée sur une seule notion, destinée à un élève qui vient d'échouer plusieurs fois de suite dessus. La fiche doit être courte (200-350 mots), en français très simple, avec au moins un exemple concret ancré dans un contexte béninois/africain francophone (marché, agriculture, transport, monnaie locale...). Structure : définition simple, un exemple concret résolu pas à pas, un point d'attention sur l'erreur fréquente.

Format de sortie JSON attendu :
{ "titre": string, "contenuMarkdown": string }`;

  const prompt = `Notion : ${input.notionNom}
Description : ${input.notionDescription}
${input.contexteCours ? `Extrait de cours pertinent :\n"""\n${input.contexteCours}\n"""` : ""}

Rédige la fiche résumé.`;

  return { system, prompt };
}
