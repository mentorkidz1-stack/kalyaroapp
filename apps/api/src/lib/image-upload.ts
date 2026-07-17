import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function saveImageFile(filename: string, buffer: Buffer) {
  await ensureUploadDir();
  const storedFilename = `${randomUUID()}-${sanitizeFilename(filename)}`;
  await writeFile(path.join(UPLOAD_DIR, storedFilename), buffer);
  return { storedFilename };
}

export function getImageFilePath(storedFilename: string) {
  return path.join(UPLOAD_DIR, storedFilename);
}

export function imageFileExists(storedFilename: string) {
  return existsSync(getImageFilePath(storedFilename));
}

export async function deleteImageFile(storedFilename: string) {
  const filePath = getImageFilePath(storedFilename);
  if (existsSync(filePath)) await unlink(filePath);
}

export function getImageContentType(storedFilename: string) {
  const ext = storedFilename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
