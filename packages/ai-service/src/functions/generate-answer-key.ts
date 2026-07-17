import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  generateAnswerKeyOutputSchema,
  type GenerateAnswerKeyInput,
  type GenerateAnswerKeyOutput,
} from "../schemas/generate-answer-key.js";
import { buildGenerateAnswerKeyPrompt } from "../prompts/generate-answer-key.js";

export async function generateAnswerKey(
  input: GenerateAnswerKeyInput
): Promise<GenerateAnswerKeyOutput> {
  const { system, prompt } = buildGenerateAnswerKeyPrompt(input);
  return generateStructured(getProvider(), {
    system,
    prompt,
    schema: generateAnswerKeyOutputSchema,
  });
}
