import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  generateInitialDiagnosticOutputSchema,
  type GenerateInitialDiagnosticInput,
  type GenerateInitialDiagnosticOutput,
} from "../schemas/generate-initial-diagnostic.js";
import { buildGenerateInitialDiagnosticPrompt } from "../prompts/generate-initial-diagnostic.js";

export async function generateInitialDiagnostic(
  input: GenerateInitialDiagnosticInput
): Promise<GenerateInitialDiagnosticOutput> {
  const { system, prompt } = buildGenerateInitialDiagnosticPrompt(input);
  return generateStructured(getProvider(), {
    system,
    prompt,
    schema: generateInitialDiagnosticOutputSchema,
  });
}
