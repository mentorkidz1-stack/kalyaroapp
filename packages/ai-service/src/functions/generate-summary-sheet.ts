import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  generateSummarySheetOutputSchema,
  type GenerateSummarySheetInput,
  type GenerateSummarySheetOutput,
} from "../schemas/generate-summary-sheet.js";
import { buildGenerateSummarySheetPrompt } from "../prompts/generate-summary-sheet.js";

export async function generateSummarySheet(
  input: GenerateSummarySheetInput
): Promise<GenerateSummarySheetOutput> {
  const { system, prompt } = buildGenerateSummarySheetPrompt(input);
  return generateStructured(getProvider(), {
    system,
    prompt,
    schema: generateSummarySheetOutputSchema,
  });
}
