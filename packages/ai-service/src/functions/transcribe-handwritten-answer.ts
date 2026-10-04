import { getProvider } from "../client.js";
import { generateStructured } from "../structured.js";
import type { ImageEntree } from "../provider.js";
import {
  transcribeHandwrittenAnswerOutputSchema,
  type TranscribeHandwrittenAnswerInput,
  type TranscribeHandwrittenAnswerOutput,
} from "../schemas/transcribe-handwritten-answer.js";
import { buildTranscribeHandwrittenAnswerPrompt } from "../prompts/transcribe-handwritten-answer.js";

/**
 * Transcrit une copie manuscrite photographiée, question par question, SANS la corriger : la
 * transcription est ensuite notée par gradeExamAnswer et montrée à l'étudiant (« ce que nous
 * avons lu »), qui peut reprendre une photo mal lue.
 */
export async function transcribeHandwrittenAnswer(
  input: TranscribeHandwrittenAnswerInput,
  images: ImageEntree[]
): Promise<TranscribeHandwrittenAnswerOutput> {
  const { system, prompt } = buildTranscribeHandwrittenAnswerPrompt(input);
  return generateStructured(getProvider(), { system, prompt, schema: transcribeHandwrittenAnswerOutputSchema, images });
}
