import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  proposePrerequisiteGraphOutputSchema,
  type ProposePrerequisiteGraphInput,
  type ProposePrerequisiteGraphOutput,
} from "../schemas/propose-prerequisite-graph.js";
import { buildProposePrerequisiteGraphPrompt } from "../prompts/propose-prerequisite-graph.js";

export async function proposePrerequisiteGraph(
  input: ProposePrerequisiteGraphInput
): Promise<ProposePrerequisiteGraphOutput> {
  const { system, prompt } = buildProposePrerequisiteGraphPrompt(input);
  return generateStructured(getProvider(), {
    system,
    prompt,
    schema: proposePrerequisiteGraphOutputSchema,
  });
}
