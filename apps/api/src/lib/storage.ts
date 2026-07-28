import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 est compatible S3 — on utilise le SDK AWS avec l'endpoint R2 du compte.
// Le stockage sur disque local ne survit pas aux redémarrages/redéploiements sur un
// hébergeur comme Render (système de fichiers éphémère), d'où ce choix plutôt qu'un
// simple accès fs.
export const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "";
