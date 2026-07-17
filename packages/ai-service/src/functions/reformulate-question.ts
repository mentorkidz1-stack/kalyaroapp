import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  reformulateQuestionOutputSchema,
  type ReformulateQuestionInput,
  type ReformulateQuestionOutput,
} from "../schemas/reformulate-question.js";
import { buildReformulateQuestionPrompt } from "../prompts/reformulate-question.js";

export async function reformulateQuestion(
  input: ReformulateQuestionInput
): Promise<ReformulateQuestionOutput> {
  const { system, prompt } = buildReformulateQuestionPrompt(input);
  return generateStructured(getProvider(), {
    system,
    prompt,
    schema: reformulateQuestionOutputSchema,
  });
}
