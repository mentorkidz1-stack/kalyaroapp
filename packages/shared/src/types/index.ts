import type { Role } from "../enums/index.js";

// Contrats d'API partagés entre apps/web et apps/api.
// Complétés au fur et à mesure de l'implémentation des modules (auth, structure, etc.).

export interface SessionUser {
  id: string;
  nom: string;
  role: Role;
  classeId: string | null;
  niveauUniversitaireId: string | null;
}
