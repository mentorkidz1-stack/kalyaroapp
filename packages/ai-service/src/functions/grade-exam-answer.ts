import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import {
  gradeExamAnswerOutputSchema,
  type GradeExamAnswerInput,
  type GradeExamAnswerOutput,
} from "../schemas/grade-exam-answer.js";
import { buildGradeExamAnswerPrompt } from "../prompts/grade-exam-answer.js";

/** Note une réponse d'épreuve sur barème (points partiels) contre les corrigés validés.
 * L'appelant borne et arrondit toujours pointsObtenus : la sortie IA n'est pas une source de vérité. */
export async function gradeExamAnswer(input: GradeExamAnswerInput): Promise<GradeExamAnswerOutput> {
  const { system, prompt } = buildGradeExamAnswerPrompt(input);
  return generateStructured(getProvider(), { system, prompt, schema: gradeExamAnswerOutputSchema });
}
