import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { GenerateSaisieLibreInput } from "../schemas/generate-saisie-libre.js";

export function buildGenerateSaisieLibrePrompt(input: GenerateSaisieLibreInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Tu génères des questions à réponse libre (l'élève rédige sa réponse en texte, pas de choix proposés) à partir d'un extrait de cours, pour tester la compréhension d'une notion précise à la fois — jamais plusieurs notions mélangées dans une même question. Ce sont des questions d'explication ou de justification ("Explique pourquoi...", "Dans tes mots..."), pas de simples questions à réponse courte factuelle. Chaque question doit taguer la notion principale qu'elle teste : réutilise un nom de la liste "notions déjà identifiées" si la question correspond exactement, sinon propose un nom de notion court et clair (2-5 mots). La "reponseReference" doit être une réponse modèle complète, servant de base de comparaison sémantique à la correction (pas juste un mot-clé).

Format de sortie JSON attendu :
{ "questions": [ { "enonce": string, "reponseReference": string, "notionTag": string } ] }`;

  const prompt = `Chapitre : ${input.chapitreTitre}
Notions déjà identifiées pour ce chapitre : ${
    input.notionsExistantes.length ? input.notionsExistantes.join(", ") : "(aucune pour l'instant)"
  }

Extrait de cours :
"""
${input.texteCours}
"""

Génère ${input.nombreQuestions} questions à réponse libre distinctes couvrant différentes notions du texte.`;

  return { system, prompt };
}
