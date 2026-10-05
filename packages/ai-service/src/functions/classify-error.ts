import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import { classifyErrorOutputSchema, type ClassifyErrorInput, type ClassifyErrorOutput } from "../schemas/classify-error.js";
import { buildClassifyErrorPrompt } from "../prompts/classify-error.js";

/** Classe la cause d'une erreur d'élève (cahier d'erreurs, chantier 3.2). */
export async function classifyError(input: ClassifyErrorInput): Promise<ClassifyErrorOutput> {
  const { system, prompt } = buildClassifyErrorPrompt(input);
  return generateStructured(getProvider(), { system, prompt, schema: classifyErrorOutputSchema });
}
