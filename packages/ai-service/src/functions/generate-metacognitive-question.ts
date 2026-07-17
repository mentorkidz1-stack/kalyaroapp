import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  generateMetacognitiveQuestionOutputSchema,
  type GenerateMetacognitiveQuestionInput,
  type GenerateMetacognitiveQuestionOutput,
} from "../schemas/generate-metacognitive-question.js";
import { buildGenerateMetacognitiveQuestionPrompt } from "../prompts/generate-metacognitive-question.js";

export async function generateMetacognitiveQuestion(
  input: GenerateMetacognitiveQuestionInput
): Promise<GenerateMetacognitiveQuestionOutput> {
  const { system, prompt } = buildGenerateMetacognitiveQuestionPrompt(input);
  return generateStructured(getProvider(), {
    system,
    prompt,
    schema: generateMetacognitiveQuestionOutputSchema,
  });
}
