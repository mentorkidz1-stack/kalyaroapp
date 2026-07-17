import type { NiveauUniv } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../plugins/error-handler.js";

// ---- Classes ----

export const listClasses = () => prisma.classe.findMany({ orderBy: { nom: "asc" } });

export const createClasse = (data: { nom: string; niveau: string; anneeScolaire?: string }) =>
  prisma.classe.create({ data });

export const updateClasse = async (
  id: string,
  data: Partial<{ nom: string; niveau: string; anneeScolaire: string }>
) => {
  const classe = await prisma.classe.findUnique({ where: { id } });
  if (!classe) throw new AppError("Classe introuvable", 404);
  return prisma.classe.update({ where: { id }, data });
};

export const deleteClasse = async (id: string) => {
  const classe = await prisma.classe.findUnique({ where: { id } });
  if (!classe) throw new AppError("Classe introuvable", 404);
  await prisma.classe.delete({ where: { id } });
};

// ---- Matières scolaires (héritage de table : Matiere + MatiereScolaire) ----

export const listMatieresScolairesByClasse = async (classeId: string) => {
  const classe = await prisma.classe.findUnique({ where: { id: classeId } });
  if (!classe) throw new AppError("Classe introuvable", 404);
  return prisma.matiereScolaire.findMany({ where: { classeId }, orderBy: { nom: "asc" } });
};

export const createMatiereScolaire = (data: { nom: string; classeId: string }) =>
  prisma.$transaction(async (tx) => {
    const classe = await tx.classe.findUnique({ where: { id: data.classeId } });
    if (!classe) throw new AppError("Classe introuvable", 404);
    const matiere = await tx.matiere.create({ data: { type: "SCOLAIRE" } });
    return tx.matiereScolaire.create({
      data: { id: matiere.id, classeId: data.classeId, nom: data.nom },
    });
  });

export const updateMatiereScolaire = async (id: string, data: { nom?: string }) => {
  const existing = await prisma.matiereScolaire.findUnique({ where: { id } });
  if (!existing) throw new AppError("Matière scolaire introuvable", 404);
  return prisma.matiereScolaire.update({ where: { id }, data });
};

export const deleteMatiereScolaire = async (id: string) => {
  const existing = await prisma.matiereScolaire.findUnique({ where: { id } });
  if (!existing) throw new AppError("Matière scolaire introuvable", 404);
  // Supprimer la Matiere ancre cascade vers la ligne MatiereScolaire (onDelete: Cascade).
  await prisma.matiere.delete({ where: { id } });
};

// ---- Filières ----

export const listFilieres = () => prisma.filiere.findMany({ orderBy: { nom: "asc" } });

export const createFiliere = (data: { nom: string }) => prisma.filiere.create({ data });

export const updateFiliere = async (id: string, data: { nom?: string }) => {
  const filiere = await prisma.filiere.findUnique({ where: { id } });
  if (!filiere) throw new AppError("Filière introuvable", 404);
  return prisma.filiere.update({ where: { id }, data });
};

export const deleteFiliere = async (id: string) => {
  const filiere = await prisma.filiere.findUnique({ where: { id } });
  if (!filiere) throw new AppError("Filière introuvable", 404);
  await prisma.filiere.delete({ where: { id } });
};

// ---- Niveaux universitaires ----

export const listNiveauxByFiliere = async (filiereId: string) => {
  const filiere = await prisma.filiere.findUnique({ where: { id: filiereId } });
  if (!filiere) throw new AppError("Filière introuvable", 404);
  return prisma.niveauUniversitaire.findMany({ where: { filiereId }, orderBy: { nom: "asc" } });
};

export const createNiveauUniversitaire = async (data: { filiereId: string; nom: NiveauUniv }) => {
  const filiere = await prisma.filiere.findUnique({ where: { id: data.filiereId } });
  if (!filiere) throw new AppError("Filière introuvable", 404);
  return prisma.niveauUniversitaire.create({ data });
};

export const updateNiveauUniversitaire = async (id: string, data: { nom?: NiveauUniv }) => {
  const niveau = await prisma.niveauUniversitaire.findUnique({ where: { id } });
  if (!niveau) throw new AppError("Niveau universitaire introuvable", 404);
  return prisma.niveauUniversitaire.update({ where: { id }, data });
};

export const deleteNiveauUniversitaire = async (id: string) => {
  const niveau = await prisma.niveauUniversitaire.findUnique({ where: { id } });
  if (!niveau) throw new AppError("Niveau universitaire introuvable", 404);
  await prisma.niveauUniversitaire.delete({ where: { id } });
};

// ---- UE / matières universitaires (héritage de table : Matiere + UEMatiere) ----

export const listUEMatieresByNiveau = async (niveauUniversitaireId: string) => {
  const niveau = await prisma.niveauUniversitaire.findUnique({
    where: { id: niveauUniversitaireId },
  });
  if (!niveau) throw new AppError("Niveau universitaire introuvable", 404);
  return prisma.uEMatiere.findMany({
    where: { niveauUniversitaireId },
    orderBy: { nom: "asc" },
  });
};

export const createUEMatiere = (data: { nom: string; niveauUniversitaireId: string }) =>
  prisma.$transaction(async (tx) => {
    const niveau = await tx.niveauUniversitaire.findUnique({
      where: { id: data.niveauUniversitaireId },
    });
    if (!niveau) throw new AppError("Niveau universitaire introuvable", 404);
    const matiere = await tx.matiere.create({ data: { type: "UNIVERSITAIRE" } });
    return tx.uEMatiere.create({
      data: { id: matiere.id, niveauUniversitaireId: data.niveauUniversitaireId, nom: data.nom },
    });
  });

export const updateUEMatiere = async (id: string, data: { nom?: string }) => {
  const existing = await prisma.uEMatiere.findUnique({ where: { id } });
  if (!existing) throw new AppError("UE introuvable", 404);
  return prisma.uEMatiere.update({ where: { id }, data });
};

export const deleteUEMatiere = async (id: string) => {
  const existing = await prisma.uEMatiere.findUnique({ where: { id } });
  if (!existing) throw new AppError("UE introuvable", 404);
  await prisma.matiere.delete({ where: { id } });
};
