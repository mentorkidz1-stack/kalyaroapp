import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Jeu de données pilote : Mathématiques · 3e · "Équations du 2nd degré"
// (périmètre validé pour le MVP du graphe de prérequis, cohérent avec la maquette).
async function reset() {
  await prisma.reponseMetacognitive.deleteMany();
  await prisma.questionMetacognitive.deleteMany();
  await prisma.diagnosticPrerequis.deleteMany();
  await prisma.diagnosticInitial.deleteMany();
  await prisma.progressionNotion.deleteMany();
  await prisma.progressionChapitre.deleteMany();
  await prisma.tentativeEleve.deleteMany();
  await prisma.corrigeType.deleteMany();
  await prisma.epreuve.deleteMany();
  await prisma.questionQcmNotion.deleteMany();
  await prisma.questionSaisieLibreNotion.deleteMany();
  await prisma.questionQcm.deleteMany();
  await prisma.questionSaisieLibre.deleteMany();
  await prisma.ficheResume.deleteMany();
  await prisma.prerequis.deleteMany();
  await prisma.notion.deleteMany();
  await prisma.chapitre.deleteMany();
  await prisma.cours.deleteMany();
  await prisma.user.deleteMany();
  await prisma.matiereScolaire.deleteMany();
  await prisma.uEMatiere.deleteMany();
  await prisma.matiere.deleteMany();
  await prisma.classe.deleteMany();
  await prisma.niveauUniversitaire.deleteMany();
  await prisma.filiere.deleteMany();
}

async function main() {
  await reset();

  const classe = await prisma.classe.create({
    data: { nom: "3e B", niveau: "3e", anneeScolaire: "2025-2026" },
  });

  const matiere = await prisma.matiere.create({ data: { type: "SCOLAIRE" } });
  await prisma.matiereScolaire.create({
    data: { id: matiere.id, classeId: classe.id, nom: "Mathématiques" },
  });

  const passwordHash = await bcrypt.hash("kalyaro-demo", 10);
  const admin = await prisma.user.create({
    data: {
      email: "admin@kalyaro.bj",
      passwordHash,
      role: "ADMIN",
      nom: "Équipe pédagogique Kalyaro",
    },
  });
  await prisma.user.create({
    data: {
      email: "eleve.demo@kalyaro.bj",
      passwordHash,
      role: "ELEVE",
      nom: "Élève Démo",
      classeId: classe.id,
    },
  });

  const cours = await prisma.cours.create({
    data: {
      matiereId: matiere.id,
      titre: "Équations du 2nd degré",
      fichierPdfUrl: "/uploads/pilote/equations-2nd-degre.pdf",
      contenuExtrait:
        "Une équation du second degré s'écrit ax² + bx + c = 0 avec a ≠ 0. " +
        "Le discriminant Δ = b² − 4ac permet de déterminer le nombre de solutions réelles.",
      statutExtraction: "DONE",
      createdById: admin.id,
    },
  });

  const chapitre = await prisma.chapitre.create({
    data: { coursId: cours.id, titre: "Équations du 2nd degré", ordre: 1 },
  });

  const [puissances, racinesCarrees, discriminant, factorisation] = await Promise.all([
    prisma.notion.create({
      data: {
        chapitreId: chapitre.id,
        nom: "Puissances",
        description: "Calcul et propriétés des puissances entières.",
      },
    }),
    prisma.notion.create({
      data: {
        chapitreId: chapitre.id,
        nom: "Racines carrées",
        description: "Définition et calcul de la racine carrée d'un nombre positif.",
      },
    }),
    prisma.notion.create({
      data: {
        chapitreId: chapitre.id,
        nom: "Discriminant",
        description: "Calcul de Δ = b² − 4ac et interprétation de son signe.",
      },
    }),
    prisma.notion.create({
      data: {
        chapitreId: chapitre.id,
        nom: "Factorisation",
        description: "Factorisation d'un trinôme du second degré à partir de ses racines.",
      },
    }),
  ]);

  // DAG : Racines carrées → Puissances → ; Discriminant → Racines carrées → ; Factorisation → Discriminant →
  await prisma.prerequis.createMany({
    data: [
      { notionId: racinesCarrees.id, prerequisNotionId: puissances.id, statut: "VALIDE_ADMIN" },
      { notionId: discriminant.id, prerequisNotionId: racinesCarrees.id, statut: "VALIDE_ADMIN" },
      { notionId: factorisation.id, prerequisNotionId: discriminant.id, statut: "VALIDE_ADMIN" },
    ],
  });

  const qcmDiscriminant = await prisma.questionQcm.create({
    data: {
      chapitreId: chapitre.id,
      enonce: "Pour l'équation 2x² − 4x − 6 = 0, quel est le discriminant Δ ?",
      choix: ["Δ = 8", "Δ = 64", "Δ = −8", "Δ = 40"],
      bonneReponse: "Δ = 64",
      source: "MANUEL",
      statut: "PUBLIE",
      difficulte: "MOYEN",
      createdById: admin.id,
    },
  });
  await prisma.questionQcmNotion.create({
    data: { questionQcmId: qcmDiscriminant.id, notionId: discriminant.id },
  });

  const qcmRacines = await prisma.questionQcm.create({
    data: {
      chapitreId: chapitre.id,
      enonce: "Quelle est la valeur de √49 ?",
      choix: ["6", "7", "14"],
      bonneReponse: "7",
      source: "MANUEL",
      statut: "PUBLIE",
      difficulte: "FACILE",
      createdById: admin.id,
    },
  });
  await prisma.questionQcmNotion.create({
    data: { questionQcmId: qcmRacines.id, notionId: racinesCarrees.id },
  });

  const saisieLibreDiscriminant = await prisma.questionSaisieLibre.create({
    data: {
      chapitreId: chapitre.id,
      enonce:
        "Explique, dans tes mots, pourquoi un discriminant négatif signifie qu'il n'y a pas de solution réelle.",
      reponseReference:
        "Un discriminant négatif signifie que √Δ n'existe pas dans les nombres réels, " +
        "donc les deux solutions de la formule ne peuvent pas être calculées dans ℝ.",
      source: "MANUEL",
      statut: "PUBLIE",
      createdById: admin.id,
    },
  });
  await prisma.questionSaisieLibreNotion.create({
    data: { questionSaisieLibreId: saisieLibreDiscriminant.id, notionId: discriminant.id },
  });

  const epreuve = await prisma.epreuve.create({
    data: {
      matiereId: matiere.id,
      chapitreId: chapitre.id,
      enonce:
        "Contrôle — Équations du 2nd degré : résoudre 2x² − 4x − 6 = 0 en détaillant le calcul du discriminant.",
      sourceCorrige: "FOURNI",
      createdById: admin.id,
    },
  });
  await prisma.corrigeType.create({
    data: {
      epreuveId: epreuve.id,
      contenu:
        "Δ = (−4)² − 4×2×(−6) = 16 + 48 = 64. √Δ = 8. x₁ = (4 − 8) / 4 = −1, x₂ = (4 + 8) / 4 = 3.",
      estPrincipal: true,
      statutValidation: "VALIDE",
      createdById: admin.id,
    },
  });

  console.log("Seed pilote terminé : Mathématiques · 3e B · Équations du 2nd degré");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
