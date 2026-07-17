import type { Role } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";

const USER_SELECT = {
  id: true,
  email: true,
  nom: true,
  role: true,
  actif: true,
  classeId: true,
  niveauUniversitaireId: true,
  createdAt: true,
  classe: { select: { nom: true } },
  niveauUniversitaire: { select: { nom: true, filiere: { select: { nom: true } } } },
} as const;

export const listUsers = (filters: {
  role?: Role;
  classeId?: string;
  niveauUniversitaireId?: string;
  q?: string;
}) =>
  prisma.user.findMany({
    where: {
      role: filters.role,
      classeId: filters.classeId,
      niveauUniversitaireId: filters.niveauUniversitaireId,
      ...(filters.q
        ? {
            OR: [
              { nom: { contains: filters.q, mode: "insensitive" as const } },
              { email: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: USER_SELECT,
    orderBy: { createdAt: "desc" },
  });

export const getUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!user) throw new AppError("Utilisateur introuvable", 404);
  return user;
};

export const updateUser = async (
  id: string,
  data: { nom?: string; classeId?: string | null; niveauUniversitaireId?: string | null; actif?: boolean }
) => {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError("Utilisateur introuvable", 404);
  return prisma.user.update({ where: { id }, data, select: USER_SELECT });
};
