/** Interface neutre — chaque fournisseur (Gemini, Anthropic...) n'implémente que `complete`. */
export interface LlmProvider {
  complete(system: string, prompt: string): Promise<string>;
}

export class AiGenerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AiGenerationError";
  }
}
