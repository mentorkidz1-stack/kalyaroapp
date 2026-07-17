import { GoogleGenAI } from "@google/genai";
import type { LlmProvider } from "../provider.js";

let client: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY manquant dans l'environnement");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export const geminiProvider: LlmProvider = {
  async complete(system: string, prompt: string): Promise<string> {
    const model = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
    const response = await getClient().models.generateContent({
      model,
      contents: prompt,
      config: { systemInstruction: system },
    });
    const text = response.text;
    if (!text) {
      throw new Error("Réponse Gemini vide");
    }
    return text;
  },
};
