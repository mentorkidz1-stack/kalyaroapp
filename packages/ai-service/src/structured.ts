import type { ZodType } from "zod";
import { AiGenerationError, type LlmProvider } from "./provider.js";

const JSON_INSTRUCTION =
  "\n\nRéponds uniquement avec un JSON valide conforme au format demandé, " +
  "sans texte avant ou après, sans balises markdown (pas de ```json).";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] ?? trimmed : trimmed;
}

// Commandes LaTeX dont l'initiale coïncide avec un échappement JSON valide (\b \f \n \r \t \u) :
// "\frac" non doublé par l'IA serait lu sans erreur comme saut de page + "rac". On ne les
// répare que si le mot entier est une commande connue, pour ne pas toucher aux vrais "\n".
const COMMANDES_LATEX_AMBIGUES = new Set([
  "begin", "beta", "bar", "big", "Big", "bigg", "binom", "bmatrix", "boxed", "bullet",
  "frac", "dfrac", "forall", "flat",
  "nabla", "neq", "not", "notin", "nu", "newline",
  "right", "rightarrow", "Rightarrow", "rho", "rangle", "rbrace", "rfloor", "rceil",
  "times", "theta", "Theta", "tau", "tan", "text", "textbf", "textit", "tfrac", "to", "top", "triangle", "tilde",
  "underline", "underbrace", "upsilon", "uparrow", "cup",
]);
const INITIALES_ECHAPPEMENT_JSON = new Set(["b", "f", "n", "r", "t", "u"]);

/**
 * Double les barres obliques inverses LaTeX que l'IA a oublié d'échapper dans ses chaînes
 * JSON. Laisse intacts les échappements déjà corrects (\\, \", \/, \n de fin de ligne…).
 */
export function reparerLatexDansJson(json: string): string {
  let out = "";
  for (let i = 0; i < json.length; i++) {
    const c = json[i]!;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const suivant = json[i + 1];
    if (suivant === undefined) {
      out += c;
      continue;
    }
    if (suivant === "\\" || suivant === '"' || suivant === "/") {
      out += c + suivant;
      i++;
      continue;
    }
    if (/[a-zA-Z]/.test(suivant)) {
      const mot = /^[a-zA-Z]+/.exec(json.slice(i + 1))![0];
      const echappementJson = INITIALES_ECHAPPEMENT_JSON.has(suivant) && !COMMANDES_LATEX_AMBIGUES.has(mot);
      out += echappementJson ? c : "\\\\";
      continue;
    }
    // \{ \} \, \; \! \  … : échappements JSON invalides, forcément du LaTeX.
    out += "\\\\";
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Demande une sortie JSON au fournisseur configuré et la valide avec un schéma Zod.
 * Relance automatiquement (jusqu'à MAX_ATTEMPTS) aussi bien sur un JSON invalide/non
 * conforme au schéma que sur une erreur transitoire du fournisseur (503, réseau...) —
 * les deux cas sont fréquents sur un tier gratuit et ne doivent jamais remonter en 500
 * générique côté API : voir AiGenerationError, mappée en 502 par apps/api.
 */
export async function generateStructured<T>(
  provider: LlmProvider,
  options: { system: string; prompt: string; schema: ZodType<T> }
): Promise<T> {
  const system = options.system + JSON_INSTRUCTION;
  let lastError = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 0
        ? options.prompt
        : `${options.prompt}\n\nTa réponse précédente n'était pas un JSON valide : ${lastError}\n` +
          "Réponds à nouveau, uniquement avec le JSON corrigé.";

    try {
      const raw = await provider.complete(system, prompt);
      const parsed = JSON.parse(reparerLatexDansJson(stripMarkdownFences(raw)));
      return options.schema.parse(parsed);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw new AiGenerationError(`Échec de génération IA après ${MAX_ATTEMPTS} tentatives : ${lastError}`);
}
