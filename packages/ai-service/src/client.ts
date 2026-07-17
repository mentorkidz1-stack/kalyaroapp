import type { LlmProvider } from "./provider.js";
import { geminiProvider } from "./providers/gemini.js";
import { anthropicProvider } from "./providers/anthropic.js";

export function getProvider(): LlmProvider {
  const name = process.env.AI_PROVIDER ?? "gemini";
  switch (name) {
    case "gemini":
      return geminiProvider;
    case "anthropic":
      return anthropicProvider;
    default:
      throw new Error(`AI_PROVIDER inconnu : "${name}" (attendu "gemini" ou "anthropic")`);
  }
}
