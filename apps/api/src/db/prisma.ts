import { PrismaClient } from "@prisma/client";

// Instance unique du client Prisma, réutilisée dans toute l'API (évite l'épuisement
// du pool de connexions en dev avec le rechargement à chaud de tsx watch).
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
