import { Badge, type BadgeVariant } from "./Badge";
import type { NodeState } from "./PathNode";

/** Niveaux de maîtrise d'une notion (voir apps/api/src/modules/progression/mastery.ts). */
export type NiveauMaitrise = "NON_VU" | "FRAGILE" | "ACQUIS_DU_JOUR" | "CONSOLIDE" | "DURABLE";

const ORDRE: NiveauMaitrise[] = ["NON_VU", "FRAGILE", "ACQUIS_DU_JOUR", "CONSOLIDE", "DURABLE"];

export const niveauxMaitrise: Record<
  NiveauMaitrise,
  { libelle: string; badge: BadgeVariant; noeud: Exclude<NodeState, "locked"> }
> = {
  NON_VU: { libelle: "À découvrir", badge: "neutral", noeud: "current" },
  FRAGILE: { libelle: "Fragile", badge: "fragile", noeud: "current" },
  ACQUIS_DU_JOUR: { libelle: "Acquis aujourd'hui", badge: "acquis", noeud: "acquired" },
  CONSOLIDE: { libelle: "Consolidé", badge: "consolide", noeud: "done" },
  DURABLE: { libelle: "Durable", badge: "durable", noeud: "durable" },
};

export function niveauAMonte(avant: NiveauMaitrise, apres: NiveauMaitrise): boolean {
  return ORDRE.indexOf(apres) > ORDRE.indexOf(avant);
}

export function MasteryBadge({ statut }: { statut: NiveauMaitrise }) {
  const niveau = niveauxMaitrise[statut];
  return <Badge variant={niveau.badge}>{niveau.libelle}</Badge>;
}
