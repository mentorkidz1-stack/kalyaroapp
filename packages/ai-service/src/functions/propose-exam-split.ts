import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  proposeExamSplitOutputSchema,
  type ProposeExamSplitInput,
  type ProposeExamSplitOutput,
} from "../schemas/propose-exam-split.js";
import { buildProposeExamSplitPrompt } from "../prompts/propose-exam-split.js";

/** Propose un découpage d'épreuve en questions : un brouillon que l'admin corrige puis enregistre. */
export async function proposeExamSplit(input: ProposeExamSplitInput): Promise<ProposeExamSplitOutput> {
  const { system, prompt } = buildProposeExamSplitPrompt(input);
  return generateStructured(getProvider(), { system, prompt, schema: proposeExamSplitOutputSchema });
}
