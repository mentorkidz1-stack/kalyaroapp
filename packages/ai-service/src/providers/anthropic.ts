import Anthropic from "@anthropic-ai/sdk";
import type { ImageEntree, LlmProvider } from "../provider.js";

// Adaptateur dormant : pas utilisé tant que AI_PROVIDER != "anthropic", conservé prêt
// pour un retour sur Claude sans toucher aux 9 fonctions IA ni aux prompts/schémas.
let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY manquant dans l'environnement");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const anthropicProvider: LlmProvider = {
  async complete(system: string, prompt: string, images: ImageEntree[] = []): Promise<string> {
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
    const response = await getClient().messages.create({
      model,
      max_tokens: 4096,
      system,
      messages: [
        {
          role: "user",
          content:
            images.length === 0
              ? prompt
              : [
                  { type: "text" as const, text: prompt },
                  ...images.map((i) => ({
                    type: "image" as const,
                    source: { type: "base64" as const, media_type: i.mimeType, data: i.base64 },
                  })),
                ],
        },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("Réponse Claude vide");
    }
    return block.text;
  },
};
