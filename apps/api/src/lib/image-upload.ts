import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3, R2_BUCKET_NAME } from "./storage.js";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function saveImageFile(filename: string, buffer: Buffer) {
  const storedFilename = `${randomUUID()}-${sanitizeFilename(filename)}`;
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
  const result = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storedFilename }));
  return result.Body as Readable;
}

export async function imageFileExists(storedFilename: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storedFilename }));
    return true;
  } catch {
    return false;
  }
}

export async function deleteImageFile(storedFilename: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storedFilename }));
}

export function getImageContentType(storedFilename: string) {
  const ext = storedFilename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
