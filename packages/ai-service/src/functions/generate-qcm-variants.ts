import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  generateQcmVariantsOutputSchema,
  type GenerateQcmVariantsInput,
  type GenerateQcmVariantsOutput,
} from "../schemas/generate-qcm-variants.js";
import { buildGenerateQcmVariantsPrompt } from "../prompts/generate-qcm-variants.js";

export async function generateQcmVariants(input: GenerateQcmVariantsInput): Promise<GenerateQcmVariantsOutput> {
  const { system, prompt } = buildGenerateQcmVariantsPrompt(input);
  return generateStructured(getProvider(), {
    system,
    prompt,
    schema: generateQcmVariantsOutputSchema,
  });
}
