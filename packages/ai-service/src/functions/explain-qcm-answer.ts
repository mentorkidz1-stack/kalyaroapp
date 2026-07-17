import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  explainQcmAnswerOutputSchema,
  type ExplainQcmAnswerInput,
  type ExplainQcmAnswerOutput,
} from "../schemas/explain-qcm-answer.js";
import { buildExplainQcmAnswerPrompt } from "../prompts/explain-qcm-answer.js";

export async function explainQcmAnswer(
  input: ExplainQcmAnswerInput
): Promise<ExplainQcmAnswerOutput> {
  const { system, prompt } = buildExplainQcmAnswerPrompt(input);
  return generateStructured(getProvider(), {
    system,
    prompt,
    schema: explainQcmAnswerOutputSchema,
  });
}
