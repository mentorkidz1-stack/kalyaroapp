import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateStructured, reparerLatexDansJson } from "./structured.js";
import { BASE_SYSTEM_INSTRUCTIONS, consignePublic } from "./prompts/shared.js";

const parse = (json: string) => JSON.parse(reparerLatexDansJson(json)) as { t: string };

describe("reparerLatexDansJson", () => {
  it("répare les commandes LaTeX qui ressemblent à des échappements JSON (\\f, \\t, \\b, \\n, \\r)", () => {
    expect(parse(String.raw`{"t":"$\frac{1}{2} \times 3$"}`).t).toBe(String.raw`$\frac{1}{2} \times 3$`);
    expect(parse(String.raw`{"t":"$$\begin{cases} x \neq 0 \end{cases}$$"}`).t).toBe(
      String.raw`$$\begin{cases} x \neq 0 \end{cases}$$`
    );
    expect(parse(String.raw`{"t":"$\theta \to \right)$"}`).t).toBe(String.raw`$\theta \to \right)$`);
  });

  it("répare les échappements invalides en JSON (\\vec, \\int, \\{, \\,)", () => {
    expect(parse(String.raw`{"t":"$\vec{u}$ et $\int_0^1 x\,dx$ et $\{1\}$"}`).t).toBe(
      String.raw`$\vec{u}$ et $\int_0^1 x\,dx$ et $\{1\}$`
    );
  });

  it("ne touche pas un JSON déjà correctement échappé", () => {
    const correct = JSON.stringify({ t: String.raw`$\frac{1}{2}$ \\ fin` });
    expect(reparerLatexDansJson(correct)).toBe(correct);
  });

  it("garde les vrais retours à la ligne, tabulations, guillemets et caractères Unicode échappés", () => {
    expect(parse(String.raw`{"t":"Ligne 1\nCalcule\tΔ \"vite\" été"}`).t).toBe(
      'Ligne 1\nCalcule\tΔ "vite" été'
    );
    // "\nest" (retour à la ligne + "est") n'est pas une commande LaTeX connue
    expect(parse(String.raw`{"t":"Fin.\nest-ce clair ?"}`).t).toBe("Fin.\nest-ce clair ?");
  });
});

describe("generateStructured avec du LaTeX non échappé", () => {
  it("rend une formule intacte même si le fournisseur oublie de doubler les \\", async () => {
    const provider = { complete: async () => String.raw`{"enonce":"Calcule $\frac{3}{4} \times 8$"}` };
    const r = await generateStructured(provider, { system: "", prompt: "", schema: z.object({ enonce: z.string() }) });
    expect(r.enonce).toBe(String.raw`Calcule $\frac{3}{4} \times 8$`);
  });
});

describe("BASE_SYSTEM_INSTRUCTIONS", () => {
  it("contient des exemples LaTeX intacts (pas de \\f ou \\b avalés par le template literal)", () => {
    expect(BASE_SYSTEM_INSTRUCTIONS).toContain(String.raw`$\frac{3}{4}$`);
    expect(BASE_SYSTEM_INSTRUCTIONS).toContain(String.raw`\begin{cases}`);
    expect(BASE_SYSTEM_INSTRUCTIONS).not.toMatch(/[\f\b]/);
  });

  it("interdit bien les délimiteurs \\( \\) et \\[ \\] (texte réellement envoyé à l'IA)", () => {
    expect(BASE_SYSTEM_INSTRUCTIONS).toContain(String.raw`N'utilise jamais \( \) ni \[ \] comme délimiteurs`);
    expect(BASE_SYSTEM_INSTRUCTIONS).toContain(String.raw`(\pi, \frac…)`);
  });
});

describe("consignePublic", () => {
  it("parle d'étudiant dans le parcours universitaire et d'élève dans le scolaire", () => {
    expect(consignePublic("UNIVERSITAIRE")).toMatch(/étudiant/);
    expect(consignePublic("UNIVERSITAIRE")).toMatch(/jamais d'« élève »/);
    expect(consignePublic("SCOLAIRE")).toMatch(/élève/);
  });
});
