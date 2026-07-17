import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  generateQcmOutputSchema,
  type GenerateQcmInput,
  type GenerateQcmOutput,
} from "../schemas/generate-qcm.js";
import { buildGenerateQcmPrompt } from "../prompts/generate-qcm.js";

export async function generateQcm(input: GenerateQcmInput): Promise<GenerateQcmOutput> {
  const { system, prompt } = buildGenerateQcmPrompt(input);
  return generateStructured(getProvider(), { system, prompt, schema: generateQcmOutputSchema });
}
