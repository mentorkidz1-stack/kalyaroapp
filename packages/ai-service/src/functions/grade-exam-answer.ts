import { getProvider } from "../client.js";
import type { ImageEntree } from "../provider.js";
import { generateStructured } from "../structured.js";
import {
  gradeExamAnswerOutputSchema,
  type GradeExamAnswerInput,
  type GradeExamAnswerOutput,
} from "../schemas/grade-exam-answer.js";
import { buildGradeExamAnswerPrompt } from "../prompts/grade-exam-answer.js";

/** Note une réponse d'épreuve sur barème (points partiels) contre les corrigés validés.
 * L'appelant borne et arrondit toujours pointsObtenus : la sortie IA n'est pas une source de vérité.
 * `imagesSujet` : extraits du sujet rattachés à la question (schéma, tableau…), montrés au correcteur. */
export async function gradeExamAnswer(
  input: GradeExamAnswerInput,
  options: { imagesSujet?: ImageEntree[] } = {}
): Promise<GradeExamAnswerOutput> {
  const images = options.imagesSujet ?? [];
  const { system, prompt } = buildGradeExamAnswerPrompt(input, images.length);
  return generateStructured(getProvider(), {
    system,
    prompt,
    schema: gradeExamAnswerOutputSchema,
    ...(images.length ? { images } : {}),
  });
}
