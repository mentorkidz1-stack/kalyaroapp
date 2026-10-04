import "dotenv/config";
import { libelleReponseAttendue, verifierQuestionSurFigure, type ReponseAttendue } from "@kalyaro/shared";
import { PrismaClient, type Difficulte } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Jeu de données de démonstration.
// - Parcours UNIVERSITAIRE (prioritaire pour le lancement) : L1 Sciences économiques et de
//   gestion, UE « Mathématiques pour l'économie » et « Statistique descriptive ».
// - Parcours SCOLAIRE (conservé) : Mathématiques · 3e · Équations du 2nd degré.
// Chaque notion a au moins 3 QCM publiés (seuil d'alerte du tableau de bord admin), et la
// première notion de chaque chapitre est sans prérequis : aucun parcours bloqué d'entrée.
// Comptes (mot de passe commun « kalyaro-demo ») : admin@kalyaro.bj, etudiant.demo@kalyaro.bj,
// eleve.demo@kalyaro.bj.

async function reset() {
  await prisma.reponseMetacognitive.deleteMany();
  await prisma.questionMetacognitive.deleteMany();
  await prisma.diagnosticPrerequis.deleteMany();
  await prisma.diagnosticInitial.deleteMany();
  await prisma.progressionNotion.deleteMany();
  await prisma.progressionChapitre.deleteMany();
  await prisma.tentativeEleve.deleteMany();
  await prisma.consumedAttemptToken.deleteMany();
  await prisma.copieEvaluation.deleteMany();
  await prisma.evaluation.deleteMany();
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

type Qcm = { enonce: string; choix: string[]; bonneReponse: string; difficulte?: Difficulte };

let adminId = "";

async function creerQcm(chapitreId: string, notionId: string, questions: Qcm[]) {
  for (const q of questions) {
    if (!q.choix.includes(q.bonneReponse)) throw new Error(`Seed incohérent : ${q.enonce}`);
    await prisma.questionQcm.create({
      data: {
        chapitreId,
        enonce: q.enonce,
        choix: q.choix,
        bonneReponse: q.bonneReponse,
        difficulte: q.difficulte ?? "MOYEN",
        source: "MANUEL",
        statut: "PUBLIE",
        createdById: adminId,
        notions: { create: [{ notionId }] },
      },
    });
  }
}

/** Question à réponse sur figure (placer un point, lire une valeur) — chantier 2.4. */
async function creerQcmSurFigure(
  chapitreId: string,
  notionId: string,
  q: { enonce: string; figure: object; reponseAttendue: ReponseAttendue; difficulte?: Difficulte }
) {
  const erreurs = verifierQuestionSurFigure(q.reponseAttendue.type, q.figure, q.reponseAttendue);
  if (erreurs.length) throw new Error(`Seed incohérent : ${q.enonce} (${erreurs.join(", ")})`);
  await prisma.questionQcm.create({
    data: {
      chapitreId,
      enonce: q.enonce,
      choix: [],
      bonneReponse: libelleReponseAttendue(q.reponseAttendue),
      typeReponse: q.reponseAttendue.type,
      reponseAttendue: q.reponseAttendue,
      figure: q.figure,
      difficulte: q.difficulte ?? "MOYEN",
      source: "MANUEL",
      statut: "PUBLIE",
      createdById: adminId,
      notions: { create: [{ notionId }] },
    },
  });
}

async function creerNotions(chapitreId: string, notions: { nom: string; description: string }[]) {
  const creees = [];
  for (const n of notions) creees.push(await prisma.notion.create({ data: { chapitreId, ...n } }));
  return creees;
}

async function prerequis(aretes: [notionId: string, prerequisNotionId: string][]) {
  await prisma.prerequis.createMany({
    data: aretes.map(([notionId, prerequisNotionId]) => ({ notionId, prerequisNotionId, statut: "VALIDE_ADMIN" as const })),
  });
}

async function creerSaisieLibre(chapitreId: string, notionId: string, enonce: string, reponseReference: string) {
  await prisma.questionSaisieLibre.create({
    data: {
      chapitreId,
      enonce,
      reponseReference,
      source: "MANUEL",
      statut: "PUBLIE",
      createdById: adminId,
      notions: { create: [{ notionId }] },
    },
  });
}

async function creerEpreuve(data: {
  matiereId: string;
  chapitreId: string;
  notionPrincipaleId: string;
  enonce: string;
  corrige: string;
}) {
  await prisma.epreuve.create({
    data: {
      matiereId: data.matiereId,
      chapitreId: data.chapitreId,
      notionPrincipaleId: data.notionPrincipaleId,
      enonce: data.enonce,
      sourceCorrige: "FOURNI",
      createdById: adminId,
      corriges: {
        create: [{ contenu: data.corrige, estPrincipal: true, statutValidation: "VALIDE", createdById: adminId }],
      },
    },
  });
}

async function creerUE(niveauUniversitaireId: string, nom: string) {
  const matiere = await prisma.matiere.create({ data: { type: "UNIVERSITAIRE" } });
  await prisma.uEMatiere.create({ data: { id: matiere.id, niveauUniversitaireId, nom } });
  return matiere;
}

/** Crée un cours d'un seul chapitre et renvoie ce chapitre. */
async function creerCours(matiereId: string, titre: string, contenuExtrait: string, titreChapitre: string) {
  const cours = await prisma.cours.create({
    data: {
      matiereId,
      titre,
      fichierPdfUrl: `/uploads/demo/${titre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
      contenuExtrait,
      statutExtraction: "DONE",
      createdById: adminId,
    },
  });
  return prisma.chapitre.create({ data: { coursId: cours.id, titre: titreChapitre, ordre: 1 } });
}

// ============================================================
// PARCOURS UNIVERSITAIRE — L1 Sciences économiques et de gestion
// ============================================================

async function seedUniversitaire(niveauId: string) {
  // ---- UE Mathématiques pour l'économie ----
  const ueMaths = await creerUE(niveauId, "Mathématiques pour l'économie");
  const analyse = await creerCours(
    ueMaths.id,
    "Analyse — fonctions d'une variable réelle",
    "Dérivée d'une fonction, sens de variation, extremums. Application à l'économie : coût " +
      "marginal Cm(q) = C'(q), recette marginale, maximisation du profit π(q) = R(q) − C(q).",
    "Dérivées et optimisation"
  );
  const [fonctions, derivees, variations, optimisation] = await creerNotions(analyse.id, [
    { nom: "Fonctions usuelles", description: "Polynômes, puissances, domaine de définition, calcul d'images." },
    { nom: "Calcul de dérivées", description: "Dérivées des fonctions usuelles, somme, produit par un réel ; coût marginal." },
    { nom: "Sens de variation", description: "Lien entre signe de la dérivée et variations ; extremums." },
    { nom: "Optimisation économique", description: "Maximisation du profit, égalité recette marginale = coût marginal." },
  ]);
  await prerequis([
    [derivees!.id, fonctions!.id],
    [variations!.id, derivees!.id],
    [optimisation!.id, variations!.id],
  ]);

  await creerQcm(analyse.id, fonctions!.id, [
    { enonce: "Si f(x) = 3x² − 2x + 5, combien vaut f(2) ?", choix: ["13", "17", "9", "21"], bonneReponse: "13", difficulte: "FACILE" },
    { enonce: "Pour tout réel x, x³ × x² est égal à :", choix: ["x⁵", "x⁶", "2x⁵", "x"], bonneReponse: "x⁵", difficulte: "FACILE" },
    {
      enonce: "Quel est le domaine de définition de $f(x) = \\frac{1}{x - 4}$ ?",
      choix: ["ℝ privé de 4", "ℝ privé de −4", "ℝ", "]4 ; +∞["],
      bonneReponse: "ℝ privé de 4",
    },
  ]);
  await creerQcmSurFigure(analyse.id, fonctions!.id, {
    enonce:
      "Au marché Dantokpa, le prix d'équilibre se lit à l'intersection de l'offre et de la demande. " +
      "Lis sur le graphique ce prix d'équilibre p.",
    figure: {
      type: "repere",
      xMin: 0,
      xMax: 10,
      yMin: 0,
      yMax: 10,
      grille: true,
      legendeX: "q",
      legendeY: "p",
      elements: [
        { type: "courbe", expression: "10 − 0,8x", nom: "Demande" },
        { type: "courbe", expression: "2 + 0,8x", nom: "Offre" },
      ],
    },
    reponseAttendue: { type: "LIRE_VALEUR", valeur: 6, tolerance: 0.2, unite: "milliers de F CFA" },
    difficulte: "FACILE",
  });
  await creerQcm(analyse.id, derivees!.id, [
    { enonce: "Si f(x) = x³, alors f'(x) = ?", choix: ["3x²", "x²", "3x³", "x⁴ ÷ 4"], bonneReponse: "3x²", difficulte: "FACILE" },
    { enonce: "Si f(x) = 5x² − 3x + 7, alors f'(x) = ?", choix: ["10x − 3", "5x − 3", "10x + 7", "10x² − 3"], bonneReponse: "10x − 3" },
    {
      enonce:
        "Une coopérative de Bohicon produit q tonnes de gari. Son coût total (en milliers de F CFA) est " +
        "C(q) = 0,5q² + 4q + 100. Quel est son coût marginal Cm(q) ?",
      choix: ["q + 4", "0,5q + 4", "q + 104", "q² + 4"],
      bonneReponse: "q + 4",
    },
  ]);
  await creerQcm(analyse.id, variations!.id, [
    {
      enonce: "On sait que f'(x) = 2x − 6. Sur quel intervalle f est-elle décroissante ?",
      choix: ["]−∞ ; 3]", "[3 ; +∞[", "]−∞ ; −3]", "ℝ"],
      bonneReponse: "]−∞ ; 3]",
    },
    {
      enonce: "Si f'(x) > 0 pour tout x d'un intervalle I, alors sur I, la fonction f est :",
      choix: ["strictement croissante", "strictement décroissante", "constante", "positive"],
      bonneReponse: "strictement croissante",
      difficulte: "FACILE",
    },
    { enonce: "La fonction f(x) = x² − 4x + 1 atteint son minimum en :", choix: ["x = 2", "x = −2", "x = 4", "x = 1"], bonneReponse: "x = 2" },
  ]);
  await creerQcmSurFigure(analyse.id, variations!.id, {
    enonce: "Voici la courbe de f(x) = x² − 4x + 1. Place sur le repère le point où f atteint son minimum.",
    figure: {
      type: "repere",
      xMin: -1,
      xMax: 5,
      yMin: -4,
      yMax: 6,
      grille: true,
      elements: [{ type: "courbe", expression: "x² − 4x + 1", nom: "𝒞f" }],
    },
    reponseAttendue: { type: "PLACER_POINT", x: 2, y: -3, tolerance: 0.25, pasGrille: 0.5 },
  });
  await creerQcm(analyse.id, optimisation!.id, [
    {
      enonce: "Le profit d'une entreprise est π(q) = −2q² + 40q − 50. Quelle quantité q maximise le profit ?",
      choix: ["q = 10", "q = 20", "q = 40", "q = 5"],
      bonneReponse: "q = 10",
    },
    {
      enonce:
        "Une vendeuse de Dantokpa a une recette R(q) = 60q et un coût C(q) = q² + 20q + 100. " +
        "Quelle quantité maximise son profit ?",
      choix: ["q = 20", "q = 40", "q = 30", "q = 10"],
      bonneReponse: "q = 20",
      difficulte: "DIFFICILE",
    },
    {
      enonce: "À la quantité q* qui maximise le profit (q* > 0), on a toujours :",
      choix: ["recette marginale = coût marginal", "recette totale = coût total", "coût marginal = 0", "recette marginale = 0"],
      bonneReponse: "recette marginale = coût marginal",
    },
  ]);
  await creerSaisieLibre(
    analyse.id,
    optimisation!.id,
    "Explique avec tes mots pourquoi, au maximum du profit, la recette marginale est égale au coût marginal.",
    "Tant que la recette marginale dépasse le coût marginal, produire une unité de plus augmente le profit ; " +
      "dès que le coût marginal dépasse la recette marginale, elle le diminue. Le profit est donc maximal " +
      "quand les deux sont égaux (π'(q) = R'(q) − C'(q) = 0)."
  );
  await creerEpreuve({
    matiereId: ueMaths.id,
    chapitreId: analyse.id,
    notionPrincipaleId: optimisation!.id,
    enonce:
      "Partiel L1 — Mathématiques pour l'économie. Une unité de transformation de noix de cajou à Parakou " +
      "vend sa production au prix p = 100 (milliers de F CFA la tonne). Son coût total est " +
      "C(q) = q² + 20q + 300. 1) Exprime le profit π(q). 2) Détermine la quantité q* qui maximise le " +
      "profit. 3) Calcule le profit maximal.",
    corrige:
      "1) π(q) = 100q − (q² + 20q + 300) = −q² + 80q − 300. 2) π'(q) = −2q + 80 = 0 ⇔ q* = 40 ; " +
      "π''(q) = −2 < 0, c'est bien un maximum. 3) π(40) = −1600 + 3200 − 300 = 1300, soit 1 300 000 F CFA.",
  });

  // ---- UE Statistique descriptive ----
  const ueStats = await creerUE(niveauId, "Statistique descriptive");
  const stats = await creerCours(
    ueStats.id,
    "Statistique descriptive",
    "Séries statistiques, effectifs. Moyenne, médiane, variance V = (1/n) Σ (xᵢ − x̄)² et écart-type σ = √V.",
    "Tendance centrale et dispersion"
  );
  const [moyenne, mediane, variance] = await creerNotions(stats.id, [
    { nom: "Moyenne", description: "Moyenne simple et pondérée d'une série statistique." },
    { nom: "Médiane", description: "Valeur qui partage la série ordonnée en deux moitiés." },
    { nom: "Variance et écart-type", description: "Mesures de dispersion autour de la moyenne." },
  ]);
  await prerequis([[variance!.id, moyenne!.id]]);

  await creerQcm(stats.id, moyenne!.id, [
    { enonce: "Les notes d'un TD sont : 8 ; 12 ; 10 ; 14 ; 16. Quelle est la moyenne ?", choix: ["12", "10", "13", "11"], bonneReponse: "12", difficulte: "FACILE" },
    {
      enonce: "La valeur 10 apparaît 3 fois et la valeur 15 apparaît 2 fois. Quelle est la moyenne de la série ?",
      choix: ["12", "12,5", "15", "13"],
      bonneReponse: "12",
    },
    {
      enonce: "Si on ajoute 2 points à toutes les notes d'une série, la moyenne :",
      choix: ["augmente de 2", "ne change pas", "double", "augmente de 2 × l'effectif"],
      bonneReponse: "augmente de 2",
    },
  ]);
  await creerQcm(stats.id, mediane!.id, [
    { enonce: "Quelle est la médiane de la série 3 ; 7 ; 9 ; 12 ; 20 ?", choix: ["9", "10,2", "7", "12"], bonneReponse: "9", difficulte: "FACILE" },
    { enonce: "Quelle est la médiane de la série 4 ; 6 ; 8 ; 10 ?", choix: ["7", "6", "8", "6,5"], bonneReponse: "7" },
    {
      enonce:
        "Dans une entreprise, on ajoute le salaire du directeur, très élevé, à la liste des salaires. " +
        "Quel indicateur change le moins ?",
      choix: ["la médiane", "la moyenne", "l'étendue", "la variance"],
      bonneReponse: "la médiane",
    },
  ]);
  await creerQcm(stats.id, variance!.id, [
    {
      enonce:
        "La variance d'une série de moyenne x̄ est $V = \\frac{1}{n}\\sum_{i=1}^{n}(x_i - \\bar{x})^2$. " +
        "Pour la série 2 ; 4 ; 6, V vaut :",
      choix: ["$\\frac{8}{3}$", "4", "$\\frac{8}{9}$", "8"],
      bonneReponse: "$\\frac{8}{3}$",
      difficulte: "DIFFICILE",
    },
    { enonce: "Une série a une variance V = 25. Son écart-type vaut :", choix: ["5", "12,5", "625", "25"], bonneReponse: "5", difficulte: "FACILE" },
    { enonce: "Quelle est la variance de la série 7 ; 7 ; 7 ; 7 ?", choix: ["0", "7", "49", "1"], bonneReponse: "0" },
  ]);
  await creerEpreuve({
    matiereId: ueStats.id,
    chapitreId: stats.id,
    notionPrincipaleId: variance!.id,
    enonce:
      "Examen de fin de semestre — Statistique descriptive. Les notes de cinq étudiants à un TD sont : " +
      "6 ; 9 ; 10 ; 12 ; 13. 1) Calcule la moyenne. 2) Donne la médiane. 3) Calcule la variance et l'écart-type.",
    corrige:
      "1) x̄ = (6 + 9 + 10 + 12 + 13) ÷ 5 = 50 ÷ 5 = 10. 2) Série ordonnée, 3e valeur : médiane = 10. " +
      "3) V = (16 + 1 + 0 + 4 + 9) ÷ 5 = 30 ÷ 5 = 6 ; σ = √6 ≈ 2,45.",
  });
}

// ============================================================
// PARCOURS SCOLAIRE — Mathématiques · 3e (conservé, non prioritaire)
// ============================================================

async function seedScolaire(matiereId: string) {
  const chapitre = await creerCours(
    matiereId,
    "Équations du 2nd degré",
    "Une équation du second degré s'écrit ax² + bx + c = 0 avec a ≠ 0. " +
      "Le discriminant Δ = b² − 4ac permet de déterminer le nombre de solutions réelles.",
    "Équations du 2nd degré"
  );
  const [puissances, racines, discriminant, factorisation] = await creerNotions(chapitre.id, [
    { nom: "Puissances", description: "Calcul et propriétés des puissances entières." },
    { nom: "Racines carrées", description: "Définition et calcul de la racine carrée d'un nombre positif." },
    { nom: "Discriminant", description: "Calcul de Δ = b² − 4ac et interprétation de son signe." },
    { nom: "Factorisation", description: "Factorisation d'un trinôme du second degré à partir de ses racines." },
  ]);
  await prerequis([
    [racines!.id, puissances!.id],
    [discriminant!.id, racines!.id],
    [factorisation!.id, discriminant!.id],
  ]);

  await creerQcm(chapitre.id, puissances!.id, [
    { enonce: "Combien vaut 2³ ?", choix: ["8", "6", "9", "5"], bonneReponse: "8", difficulte: "FACILE" },
    { enonce: "10² × 10³ est égal à :", choix: ["10⁵", "10⁶", "100⁵", "10¹"], bonneReponse: "10⁵" },
    { enonce: "Combien vaut (−3)² ?", choix: ["9", "−9", "6", "−6"], bonneReponse: "9" },
  ]);
  await creerQcm(chapitre.id, racines!.id, [
    { enonce: "Quelle est la valeur de √49 ?", choix: ["6", "7", "14"], bonneReponse: "7", difficulte: "FACILE" },
    { enonce: "√(9 × 4) est égal à :", choix: ["6", "13", "36", "√13"], bonneReponse: "6" },
    { enonce: "√50 est égal à :", choix: ["5√2", "25√2", "2√5", "10√5"], bonneReponse: "5√2", difficulte: "DIFFICILE" },
  ]);
  await creerQcm(chapitre.id, discriminant!.id, [
    { enonce: "Pour l'équation 2x² − 4x − 6 = 0, quel est le discriminant Δ ?", choix: ["Δ = 8", "Δ = 64", "Δ = −8", "Δ = 40"], bonneReponse: "Δ = 64" },
    { enonce: "Pour l'équation x² + 2x + 1 = 0, quel est le discriminant Δ ?", choix: ["Δ = 0", "Δ = 4", "Δ = 8", "Δ = −4"], bonneReponse: "Δ = 0" },
    {
      enonce: "Si Δ < 0, l'équation ax² + bx + c = 0 admet :",
      choix: ["aucune solution réelle", "une solution double", "deux solutions réelles", "une infinité de solutions"],
      bonneReponse: "aucune solution réelle",
      difficulte: "FACILE",
    },
  ]);
  await creerQcm(chapitre.id, factorisation!.id, [
    { enonce: "x² − 5x + 6 se factorise en :", choix: ["(x − 2)(x − 3)", "(x + 2)(x + 3)", "(x − 1)(x − 6)", "(x − 2)(x + 3)"], bonneReponse: "(x − 2)(x − 3)" },
    { enonce: "x² − 9 se factorise en :", choix: ["(x − 3)(x + 3)", "(x − 3)²", "(x − 9)(x + 1)", "(x + 3)²"], bonneReponse: "(x − 3)(x + 3)", difficulte: "FACILE" },
    {
      enonce: "Sachant que 2x² − 4x − 6 = 0 a pour solutions −1 et 3, le trinôme se factorise en :",
      choix: ["2(x + 1)(x − 3)", "(x + 1)(x − 3)", "2(x − 1)(x + 3)", "(2x + 1)(x − 3)"],
      bonneReponse: "2(x + 1)(x − 3)",
      difficulte: "DIFFICILE",
    },
  ]);
  await creerSaisieLibre(
    chapitre.id,
    discriminant!.id,
    "Explique, dans tes mots, pourquoi un discriminant négatif signifie qu'il n'y a pas de solution réelle.",
    "Un discriminant négatif signifie que √Δ n'existe pas dans les nombres réels, " +
      "donc les deux solutions de la formule ne peuvent pas être calculées dans ℝ."
  );
  await creerEpreuve({
    matiereId,
    chapitreId: chapitre.id,
    notionPrincipaleId: discriminant!.id,
    enonce: "Contrôle — Équations du 2nd degré : résoudre 2x² − 4x − 6 = 0 en détaillant le calcul du discriminant.",
    corrige: "Δ = (−4)² − 4×2×(−6) = 16 + 48 = 64. √Δ = 8. x₁ = (4 − 8) / 4 = −1, x₂ = (4 + 8) / 4 = 3.",
  });
}

async function main() {
  await reset();
  const passwordHash = await bcrypt.hash("kalyaro-demo", 10);

  const admin = await prisma.user.create({
    data: { email: "admin@kalyaro.bj", passwordHash, role: "ADMIN", nom: "Équipe pédagogique Kalyaro" },
  });
  adminId = admin.id;

  const filiere = await prisma.filiere.create({ data: { nom: "Sciences économiques et de gestion" } });
  const l1 = await prisma.niveauUniversitaire.create({ data: { filiereId: filiere.id, nom: "L1" } });
  await prisma.user.create({
    data: {
      email: "etudiant.demo@kalyaro.bj",
      passwordHash,
      role: "ETUDIANT",
      nom: "Étudiante Démo",
      niveauUniversitaireId: l1.id,
    },
  });
  await seedUniversitaire(l1.id);

  const classe = await prisma.classe.create({ data: { nom: "3e B", niveau: "3e", anneeScolaire: "2025-2026" } });
  const mathsScolaire = await prisma.matiere.create({ data: { type: "SCOLAIRE" } });
  await prisma.matiereScolaire.create({ data: { id: mathsScolaire.id, classeId: classe.id, nom: "Mathématiques" } });
  await prisma.user.create({
    data: { email: "eleve.demo@kalyaro.bj", passwordHash, role: "ELEVE", nom: "Élève Démo", classeId: classe.id },
  });
  await seedScolaire(mathsScolaire.id);

  const [nbNotions, nbQcm] = await Promise.all([prisma.notion.count(), prisma.questionQcm.count()]);
  console.log(`Seed terminé : L1 Sciences économiques et de gestion (2 UE) + 3e B — ${nbNotions} notions, ${nbQcm} QCM publiés.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
