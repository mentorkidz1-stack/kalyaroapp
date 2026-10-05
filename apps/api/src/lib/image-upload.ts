import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3, R2_BUCKET_NAME } from "./storage.js";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Où stocker les images : R2 quand il est configuré ; sinon, en développement seulement, un
 * dossier local (uploads/, ignoré par git) pour pouvoir tout tester sans compte Cloudflare.
 * En production sans R2 : aucun stockage (le disque de Render est effacé à chaque déploiement).
 */
export function modeStockageImages(): "r2" | "disque" | null {
  if (process.env.R2_ENDPOINT && R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID) return "r2";
  return process.env.NODE_ENV === "production" ? null : "disque";
}

const DOSSIER_LOCAL = path.resolve(process.cwd(), "uploads", "images");
/** Clé générée par nous (uuid + nom assaini) : jamais de « / » ni de « .. » vers le disque. */
const cheminLocal = (cle: string) => path.join(DOSSIER_LOCAL, path.basename(cle));

export async function saveImageFile(filename: string, buffer: Buffer) {
  const storedFilename = `${randomUUID()}-${sanitizeFilename(filename)}`;
  if (modeStockageImages() === "disque") {
    await mkdir(DOSSIER_LOCAL, { recursive: true });
    await writeFile(cheminLocal(storedFilename), buffer);
    return { storedFilename };
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storedFilename,
      Body: buffer,
      ContentType: getImageContentType(storedFilename),
    })
  );
  return { storedFilename };
}

export async function getImageFileStream(storedFilename: string): Promise<Readable> {
  if (modeStockageImages() === "disque") return createReadStream(cheminLocal(storedFilename));
  const result = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storedFilename }));
  return result.Body as Readable;
}

export async function imageFileExists(storedFilename: string): Promise<boolean> {
  try {
    if (modeStockageImages() === "disque") await access(cheminLocal(storedFilename));
    else await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storedFilename }));
    return true;
  } catch {
    return false;
  }
}

export async function deleteImageFile(storedFilename: string) {
  if (modeStockageImages() === "disque") {
    await unlink(cheminLocal(storedFilename)).catch(() => undefined);
    return;
  }
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storedFilename }));
}

export function getImageContentType(storedFilename: string) {
  const ext = storedFilename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
