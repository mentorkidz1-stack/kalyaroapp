import type { TypeErreur } from "@kalyaro/ai-service";

// Cahier d'erreurs (chantier 3.2) — fonction pure : regroupe les erreurs d'un élève par
// notion et par type, et dégage ses « erreurs signature » (les couples notion × type qui
// reviennent le plus parmi les erreurs pas encore rattrapées).

export type SourceErreur = "QCM" | "SAISIE_LIBRE" | "EPREUVE";

export interface ErreurEleve {
  id: string;
  createdAt: Date;
  notionId: string | null;
  notionNom: string | null;
  chapitreId: string | null;
  /** null tant que l'IA n'a pas classé l'erreur (ou si le classement a échoué). */
  typeErreur: TypeErreur | null;
  explication: string | null;
  enonce: string;
  source: SourceErreur;
  /** Rattrapée : une question de la même famille a été réussie depuis. */
  corrigee: boolean;
}

export interface ErreurResume {
  id: string;
  date: Date;
  typeErreur: TypeErreur | null;
  explication: string | null;
  enonce: string;
  source: SourceErreur;
  statut: "A_TRAVAILLER" | "EN_VOIE_DE_CORRECTION";
}

export interface ErreurSignature {
  notionId: string;
  notionNom: string;
  chapitreId: string | null;
  typeErreur: TypeErreur;
  nombre: number;
  derniere: ErreurResume;
}

export interface NotionDuCahier {
  notionId: string;
  notionNom: string;
  chapitreId: string | null;
  aTravailler: number;
  enVoieDeCorrection: number;
  parType: Partial<Record<TypeErreur, number>>;
  /** Les plus récentes d'abord, plafonnées. */
  erreurs: ErreurResume[];
}

export interface CahierErreurs {
  aTravailler: number;
  enVoieDeCorrection: number;
  /** Erreurs pas encore classées (IA en cours ou indisponible). */
  nonClassees: number;
  parType: { typeErreur: TypeErreur; aTravailler: number; enVoieDeCorrection: number }[];
  signatures: ErreurSignature[];
  notions: NotionDuCahier[];
}

export const NB_SIGNATURES = 3;
export const ERREURS_PAR_NOTION = 5;

const resume = (e: ErreurEleve): ErreurResume => ({
  id: e.id,
  date: e.createdAt,
  typeErreur: e.typeErreur,
  explication: e.explication,
  enonce: e.enonce,
  source: e.source,
  statut: e.corrigee ? "EN_VOIE_DE_CORRECTION" : "A_TRAVAILLER",
});

export function construireCahierErreurs(erreurs: ErreurEleve[]): CahierErreurs {
  const triees = [...erreurs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const parType = new Map<TypeErreur, { aTravailler: number; enVoieDeCorrection: number }>();
  const signatures = new Map<string, ErreurSignature>();
  const notions = new Map<string, NotionDuCahier>();
  let nonClassees = 0;

  for (const e of triees) {
    if (e.typeErreur) {
      const t = parType.get(e.typeErreur) ?? { aTravailler: 0, enVoieDeCorrection: 0 };
      if (e.corrigee) t.enVoieDeCorrection += 1;
      else t.aTravailler += 1;
      parType.set(e.typeErreur, t);
    } else {
      nonClassees += 1;
    }

    if (!e.notionId) continue;
    const n = notions.get(e.notionId) ?? {
      notionId: e.notionId,
      notionNom: e.notionNom ?? "Notion",
      chapitreId: e.chapitreId,
      aTravailler: 0,
      enVoieDeCorrection: 0,
      parType: {},
      erreurs: [],
    };
    if (e.corrigee) n.enVoieDeCorrection += 1;
    else n.aTravailler += 1;
    if (e.typeErreur) n.parType[e.typeErreur] = (n.parType[e.typeErreur] ?? 0) + 1;
    if (n.erreurs.length < ERREURS_PAR_NOTION) n.erreurs.push(resume(e));
    notions.set(e.notionId, n);

    // Signature : seulement ce qui reste à travailler, et classé.
    if (!e.corrigee && e.typeErreur) {
      const cle = `${e.notionId}|${e.typeErreur}`;
      const s = signatures.get(cle);
      if (s) s.nombre += 1;
      else
        signatures.set(cle, {
          notionId: e.notionId,
          notionNom: e.notionNom ?? "Notion",
          chapitreId: e.chapitreId,
          typeErreur: e.typeErreur,
          nombre: 1,
          derniere: resume(e), // erreurs parcourues de la plus récente à la plus ancienne
        });
    }
  }

  const aTravailler = triees.filter((e) => !e.corrigee).length;
  return {
    aTravailler,
    enVoieDeCorrection: triees.length - aTravailler,
    nonClassees,
    parType: [...parType.entries()]
      .map(([typeErreur, c]) => ({ typeErreur, ...c }))
      .sort((a, b) => b.aTravailler - a.aTravailler || b.enVoieDeCorrection - a.enVoieDeCorrection),
    signatures: [...signatures.values()]
      .sort((a, b) => b.nombre - a.nombre || b.derniere.date.getTime() - a.derniere.date.getTime())
      .slice(0, NB_SIGNATURES),
    // Notions avec le plus d'erreurs à travailler d'abord.
    notions: [...notions.values()].sort(
      (a, b) => b.aTravailler - a.aTravailler || b.erreurs[0]!.date.getTime() - a.erreurs[0]!.date.getTime()
    ),
  };
}
