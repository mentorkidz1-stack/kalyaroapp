import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  buildDiagnosePrerequisiteOutputSchema,
  type DiagnosePrerequisiteInput,
  type DiagnosePrerequisiteOutput,
} from "../schemas/diagnose-prerequisite.js";
import { buildDiagnosePrerequisitePrompt } from "../prompts/diagnose-prerequisite.js";

export async function diagnosePrerequisite(
  input: DiagnosePrerequisiteInput
): Promise<DiagnosePrerequisiteOutput> {
  const { system, prompt } = buildDiagnosePrerequisitePrompt(input);
  const schema = buildDiagnosePrerequisiteOutputSchema(input.prerequisDirects);
  return generateStructured(getProvider(), { system, prompt, schema });
}
