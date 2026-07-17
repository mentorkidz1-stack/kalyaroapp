import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { GenerateInitialDiagnosticInput } from "../schemas/generate-initial-diagnostic.js";

export function buildGenerateInitialDiagnosticPrompt(input: GenerateInitialDiagnosticInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Tu génères un diagnostic initial rapide (3 à 4 questions) que l'élève passe avant de commencer un nouveau chapitre, pour situer son niveau et le placer dans sa zone d'apprentissage optimale (ni trop facile, ni trop difficile). Mélange des questions sur les prérequis externes déjà vus (pour vérifier qu'ils sont acquis) et sur les toutes premières notions du chapitre (pour voir s'il en connaît déjà certaines).

Format de sortie JSON attendu :
{ "questions": [ { "enonce": string, "choix": string[] (exactement 4 choix), "bonneReponse": string, "notionNom": string } ] } (3 à 4 questions)`;

  const chapitreNotions = input.notionsChapitre.map((n) => `- ${n.nom} : ${n.description}`).join("\n");
  const prerequisExternes = input.notionsPrerequisesExternes.length
    ? input.notionsPrerequisesExternes.map((n) => `- ${n.nom} : ${n.description}`).join("\n")
    : "(aucun)";

  const prompt = `Chapitre à venir : ${input.chapitreTitre}

Notions du chapitre :
${chapitreNotions}

Prérequis externes déjà vus (autres chapitres) :
${prerequisExternes}

Génère le diagnostic initial.`;

  return { system, prompt };
}
