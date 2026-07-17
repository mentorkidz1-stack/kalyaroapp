// Ces enums reflètent exactement les enums Prisma (apps/api/prisma/schema.prisma).
// Toute modification doit être répercutée des deux côtés.

export const TypeParcours = {
  SCOLAIRE: "SCOLAIRE",
  UNIVERSITAIRE: "UNIVERSITAIRE",
} as const;
export type TypeParcours = (typeof TypeParcours)[keyof typeof TypeParcours];

export const Role = {
  ADMIN: "ADMIN",
  ELEVE: "ELEVE",
  ETUDIANT: "ETUDIANT",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const NiveauUniv = {
  L1: "L1",
  L2: "L2",
  L3: "L3",
  M1: "M1",
  M2: "M2",
} as const;
export type NiveauUniv = (typeof NiveauUniv)[keyof typeof NiveauUniv];

export const StatutExtraction = {
  PENDING: "PENDING",
  DONE: "DONE",
  ERROR: "ERROR",
} as const;
export type StatutExtraction = (typeof StatutExtraction)[keyof typeof StatutExtraction];

export const StatutPrerequis = {
  PROPOSE_IA: "PROPOSE_IA",
  VALIDE_ADMIN: "VALIDE_ADMIN",
} as const;
export type StatutPrerequis = (typeof StatutPrerequis)[keyof typeof StatutPrerequis];

export const SourceQuestion = {
  IA: "IA",
  MANUEL: "MANUEL",
} as const;
export type SourceQuestion = (typeof SourceQuestion)[keyof typeof SourceQuestion];

export const StatutQuestion = {
  BROUILLON: "BROUILLON",
  A_VALIDER: "A_VALIDER",
  PUBLIE: "PUBLIE",
} as const;
export type StatutQuestion = (typeof StatutQuestion)[keyof typeof StatutQuestion];

export const Difficulte = {
  FACILE: "FACILE",
  MOYEN: "MOYEN",
  DIFFICILE: "DIFFICILE",
} as const;
export type Difficulte = (typeof Difficulte)[keyof typeof Difficulte];

export const SourceCorrige = {
  FOURNI: "FOURNI",
  GENERE: "GENERE",
} as const;
export type SourceCorrige = (typeof SourceCorrige)[keyof typeof SourceCorrige];

export const StatutValidation = {
  A_VALIDER: "A_VALIDER",
  VALIDE: "VALIDE",
} as const;
export type StatutValidation = (typeof StatutValidation)[keyof typeof StatutValidation];

export const TypeCibleTentative = {
  QCM: "QCM",
  SAISIE_LIBRE: "SAISIE_LIBRE",
  EPREUVE: "EPREUVE",
} as const;
export type TypeCibleTentative = (typeof TypeCibleTentative)[keyof typeof TypeCibleTentative];

export const StatutMaitriseNotion = {
  NON_VU: "NON_VU",
  FRAGILE: "FRAGILE",
  MAITRISE: "MAITRISE",
} as const;
export type StatutMaitriseNotion = (typeof StatutMaitriseNotion)[keyof typeof StatutMaitriseNotion];

export const StatutChapitre = {
  NON_COMMENCE: "NON_COMMENCE",
  EN_COURS: "EN_COURS",
  MAITRISE: "MAITRISE",
} as const;
export type StatutChapitre = (typeof StatutChapitre)[keyof typeof StatutChapitre];

export const StatutFicheResume = {
  A_VALIDER: "A_VALIDER",
  PUBLIE: "PUBLIE",
} as const;
export type StatutFicheResume = (typeof StatutFicheResume)[keyof typeof StatutFicheResume];
