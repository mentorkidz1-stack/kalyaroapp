import { afterEach, describe, expect, it, vi } from "vitest";
import { signQcmAttemptToken, verifyQcmAttemptToken } from "./attempt-token.js";

const payload = {
  eleveId: "etudiant-1",
  notionId: "notion-1",
  questionQcmId: "question-1",
  bonneReponse: "f'(x) = 2x",
  enonce: "Quelle est la dérivée de f(x) = x² ?",
  choix: ["f'(x) = x", "f'(x) = 2x", "f'(x) = x²", "f'(x) = 2"],
};

afterEach(() => {
  vi.useRealTimers();
});

describe("jetons de tentative QCM", () => {
  it("restitue le contenu signé après vérification", () => {
    const decoded = verifyQcmAttemptToken(signQcmAttemptToken(payload));
    expect(decoded).toMatchObject({ ...payload, type: "qcm_attempt" });
  });

  it("ne laisse pas lire la bonne réponse dans le jeton", () => {
    const token = signQcmAttemptToken(payload);
    const lisible = token
      .split(".")
      .map((part) => Buffer.from(part, "base64url").toString("utf8"))
      .join("");
    expect(lisible).not.toContain(payload.bonneReponse);
  });

  it("donne un jti différent à chaque jeton, même pour une question identique", () => {
    const a = verifyQcmAttemptToken(signQcmAttemptToken(payload));
    const b = verifyQcmAttemptToken(signQcmAttemptToken(payload));
    expect(a.jti).not.toBe(b.jti);
  });

  it("refuse un jeton modifié", () => {
    const [iv, tag, ciphertext] = signQcmAttemptToken(payload).split(".") as [string, string, string];
    const bytes = Buffer.from(ciphertext, "base64url");
    bytes[0] = bytes[0]! ^ 0xff;
    const altere = `${iv}.${tag}.${bytes.toString("base64url")}`;
    expect(() => verifyQcmAttemptToken(altere)).toThrow(/invalide/);
  });

  it("refuse un jeton mal formé", () => {
    expect(() => verifyQcmAttemptToken("pas-un-jeton")).toThrow(/invalide/);
    expect(() => verifyQcmAttemptToken("a..c")).toThrow(/invalide/);
  });

  it("refuse un jeton expiré (validité de 15 minutes)", () => {
    vi.useFakeTimers({ now: new Date("2026-10-06T10:00:00Z") });
    const token = signQcmAttemptToken(payload);
    vi.setSystemTime(new Date("2026-10-06T10:14:00Z"));
    expect(() => verifyQcmAttemptToken(token)).not.toThrow();
    vi.setSystemTime(new Date("2026-10-06T10:16:00Z"));
    expect(() => verifyQcmAttemptToken(token)).toThrow(/expiré/);
  });
});
