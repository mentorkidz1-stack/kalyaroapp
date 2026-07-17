import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";

const SALT_ROUNDS = 10;

export function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function toSessionUser(user: User) {
  return {
    id: user.id,
    nom: user.nom,
    role: user.role,
    classeId: user.classeId,
    niveauUniversitaireId: user.niveauUniversitaireId,
  };
}

export async function registerUser(input: {
  email: string;
  password: string;
  nom: string;
  typeParcours: "SCOLAIRE" | "UNIVERSITAIRE";
  classeId?: string;
  niveauUniversitaireId?: string;
}): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("Un compte existe déjà avec cet email", 409);
  }

  if (input.typeParcours === "SCOLAIRE") {
    const classe = await prisma.classe.findUnique({ where: { id: input.classeId } });
    if (!classe) throw new AppError("Classe introuvable", 404);
  } else {
    const niveau = await prisma.niveauUniversitaire.findUnique({
      where: { id: input.niveauUniversitaireId },
    });
    if (!niveau) throw new AppError("Niveau universitaire introuvable", 404);
  }

  const passwordHash = await hashPassword(input.password);
  const role: Role = input.typeParcours === "SCOLAIRE" ? "ELEVE" : "ETUDIANT";

  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      nom: input.nom,
      role,
      classeId: input.typeParcours === "SCOLAIRE" ? input.classeId : null,
      niveauUniversitaireId:
        input.typeParcours === "UNIVERSITAIRE" ? input.niveauUniversitaireId : null,
    },
  });
}

export async function authenticateUser(email: string, password: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError("Email ou mot de passe incorrect", 401);
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new AppError("Email ou mot de passe incorrect", 401);
  if (!user.actif) throw new AppError("Ce compte a été désactivé", 403);
  return user;
}

export async function createAdmin(input: {
  email: string;
  password: string;
  nom: string;
}): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError("Un compte existe déjà avec cet email", 409);
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: { email: input.email, passwordHash, nom: input.nom, role: "ADMIN" },
  });
}
