/** Image jointe à une requête (photo de copie manuscrite…), encodée en base64. */
export interface ImageEntree {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

/** Interface neutre — chaque fournisseur (Gemini, Anthropic...) n'implémente que `complete`.
 * Les images, facultatives, sont envoyées après le texte de la requête. */
export interface LlmProvider {
  complete(system: string, prompt: string, images?: ImageEntree[]): Promise<string>;
}

export class AiGenerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AiGenerationError";
  }
}
