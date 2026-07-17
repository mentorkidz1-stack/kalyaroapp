import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AppError } from "../../plugins/error-handler.js";

// Jeton dédié aux questions QCM reformulées/piochées à la volée : pas persistées comme
// nouvelle ligne QuestionQcm (ce serait polluer la banque avec du contenu à usage unique).
//
// Chiffré (AES-256-GCM), pas juste signé : un JWT classique (jwt.sign) est signé mais son
// payload reste lisible en clair par simple décodage base64 — un élève technique pouvait
// lire `bonneReponse` directement dans le jeton sans répondre à la question. Le chiffrement
// rend le contenu illisible sans la clé serveur, tout en gardant une interface opaque
// (string en entrée/sortie) identique pour les appelants.
export interface QcmAttemptTokenPayload {
  type: "qcm_attempt";
  jti: string;
  eleveId: string;
  notionId: string;
  questionQcmId: string;
  bonneReponse: string;
  enonce: string;
  choix: string[];
}

const TOKEN_TTL_MS = 15 * 60 * 1000;

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? "change-me-in-production";
  return createHash("sha256").update(secret).digest();
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function signQcmAttemptToken(payload: Omit<QcmAttemptTokenPayload, "type" | "jti">): string {
  const jti = randomBytes(16).toString("base64url");
  const body = JSON.stringify({ ...payload, type: "qcm_attempt", jti, exp: Date.now() + TOKEN_TTL_MS });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${base64url(iv)}.${base64url(tag)}.${base64url(ciphertext)}`;
}

export function verifyQcmAttemptToken(token: string): QcmAttemptTokenPayload & { exp: number } {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((p) => !p)) {
    throw new AppError("Jeton de tentative invalide", 400);
  }
  const [ivPart, tagPart, ciphertextPart] = parts as [string, string, string];

  let decoded: QcmAttemptTokenPayload & { exp: number };
  try {
    const iv = Buffer.from(ivPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");
    const ciphertext = Buffer.from(ciphertextPart, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    decoded = JSON.parse(plaintext);
  } catch {
    throw new AppError("Jeton de tentative invalide ou expiré", 400);
  }

  if (decoded.type !== "qcm_attempt") {
    throw new AppError("Jeton de tentative invalide", 400);
  }
  if (typeof decoded.exp !== "number" || Date.now() > decoded.exp) {
    throw new AppError("Jeton de tentative invalide ou expiré", 400);
  }
  return decoded;
}
