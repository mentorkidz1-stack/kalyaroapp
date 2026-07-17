import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  generateEvaluationFeedbackOutputSchema,
  type GenerateEvaluationFeedbackInput,
  type GenerateEvaluationFeedbackOutput,
} from "../schemas/generate-evaluation-feedback.js";
import { buildGenerateEvaluationFeedbackPrompt } from "../prompts/generate-evaluation-feedback.js";

export async function generateEvaluationFeedback(
  input: GenerateEvaluationFeedbackInput
): Promise<GenerateEvaluationFeedbackOutput> {
  const { system, prompt } = buildGenerateEvaluationFeedbackPrompt(input);
  return generateStructured(getProvider(), {
    system,
    prompt,
    schema: generateEvaluationFeedbackOutputSchema,
  });
}
