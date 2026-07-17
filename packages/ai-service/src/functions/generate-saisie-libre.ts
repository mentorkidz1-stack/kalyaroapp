import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  generateSaisieLibreOutputSchema,
  type GenerateSaisieLibreInput,
  type GenerateSaisieLibreOutput,
} from "../schemas/generate-saisie-libre.js";
import { buildGenerateSaisieLibrePrompt } from "../prompts/generate-saisie-libre.js";

export async function generateSaisieLibre(input: GenerateSaisieLibreInput): Promise<GenerateSaisieLibreOutput> {
  const { system, prompt } = buildGenerateSaisieLibrePrompt(input);
  return generateStructured(getProvider(), { system, prompt, schema: generateSaisieLibreOutputSchema });
}
