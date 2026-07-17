import { BASE_SYSTEM_INSTRUCTIONS } from "./shared.js";
import type { ProposePrerequisiteGraphInput } from "../schemas/propose-prerequisite-graph.js";

export function buildProposePrerequisiteGraphPrompt(input: ProposePrerequisiteGraphInput) {
  const system = `${BASE_SYSTEM_INSTRUCTIONS}

Tu analyses un extrait de cours pour en extraire les notions atomiques (unités de connaissance les plus petites et testables individuellement) et le graphe de dépendances entre elles (une notion "dépend de" un prérequis si on ne peut pas la comprendre sans maîtriser ce prérequis d'abord). Le graphe doit être acyclique — ne jamais créer de dépendance circulaire. Cette proposition sera relue et corrigée par un enseignant avant publication.

Format de sortie JSON attendu :
{ "notions": [ { "nom": string, "description": string } ], "prerequisites": [ { "notion": string, "prerequisDe": string } ] }
(chaque "notion" et "prerequisDe" dans "prerequisites" doit être un des noms listés dans "notions")`;

  const prompt = `Chapitre : ${input.chapitreTitre}

Extrait de cours :
"""
${input.texteCours}
"""

Propose le graphe de notions et de prérequis.`;

  return { system, prompt };
}
