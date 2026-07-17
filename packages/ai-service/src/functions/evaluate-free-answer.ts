import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  evaluateFreeAnswerOutputSchema,
  type EvaluateFreeAnswerInput,
  type EvaluateFreeAnswerOutput,
} from "../schemas/evaluate-free-answer.js";
import { buildEvaluateFreeAnswerPrompt } from "../prompts/evaluate-free-answer.js";

export async function evaluateFreeAnswer(
  input: EvaluateFreeAnswerInput
): Promise<EvaluateFreeAnswerOutput> {
  const { system, prompt } = buildEvaluateFreeAnswerPrompt(input);
  return generateStructured(getProvider(), {
    system,
    prompt,
    schema: evaluateFreeAnswerOutputSchema,
  });
}
