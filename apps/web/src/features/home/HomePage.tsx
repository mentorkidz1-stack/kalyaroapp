import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/auth";
import { Card, Button, BrandMark } from "../../design-system";

const PILIERS = [
  {
    emoji: "🧭",
    titre: "Un parcours qui s'adapte",
    texte:
      "Chaque élève avance à son rythme. Kalyaro repère les notions déjà maîtrisées et celles qui ont besoin de plus de pratique.",
  },
  {
    emoji: "🔗",
    titre: "Les vrais prérequis",
    texte:
      "Face à une difficulté, Kalyaro remonte jusqu'à la notion réellement en cause — pas juste au dernier exercice raté.",
  },
  {
    emoji: "🤖",
    titre: "Des explications claires",
    texte:
      "Questions reformulées, fiches résumé, exemples ancrés dans le quotidien béninois — générés par IA, toujours relus par un enseignant avant publication.",
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);

  if (token) {
    return <Navigate to={role === "ADMIN" ? "/admin" : "/cours"} replace />;
  }

  const mailtoTesteur =
    "mailto:coachgamalielmehou@gmail.com" +
    "?subject=" +
    encodeURIComponent("Je veux devenir testeur Kalyaro") +
    "&body=" +
    encodeURIComponent(
      "Bonjour,\n\nJe suis intéressé(e) pour devenir testeur/testeuse de Kalyaro.\n\nMon nom : \nMon établissement : \nMa classe / filière : "
    );

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-accent-tint border-b-2 border-accent">
        <div className="max-w-3xl mx-auto px-6 py-4 text-center">
          <p className="text-base md:text-lg font-semibold text-ink mb-2">
            🧪 Kalyaro est actuellement en phase de test.
          </p>
          <p className="text-base text-ink-soft mb-3">
            Tu es élève ou étudiant ? Deviens testeur et donne-nous ton avis en avant-première.
          </p>
          <a
            href={mailtoTesteur}
            className="inline-block text-base font-semibold text-ink underline underline-offset-2"
          >
            Je veux devenir testeur →
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-10">
          <BrandMark />
          <div className="font-display font-extrabold text-2xl text-ink">Kalyaro</div>
        </div>

        <div className="text-center mb-12">
          <h1 className="font-display font-extrabold text-4xl md:text-5xl text-ink leading-tight mb-4">
            L'apprentissage adaptatif, pensé pour le Bénin
          </h1>
          <p className="text-lg text-ink-soft max-w-xl mx-auto mb-8">
            Une application pour les élèves du secondaire et les étudiants, qui identifie précisément
            ce qui bloque la compréhension — et propose le bon exercice, au bon moment.
          </p>
          <Button className="w-auto px-8" onClick={() => navigate("/connexion")}>
            Commencer
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-12">
          {PILIERS.map((p) => (
            <Card key={p.titre}>
              <div className="text-4xl mb-2">{p.emoji}</div>
              <div className="font-display font-bold text-base text-ink mb-2">{p.titre}</div>
              <p className="text-sm text-ink-soft leading-relaxed">{p.texte}</p>
            </Card>
          ))}
        </div>

        <Card className="text-center">
          <div className="font-display font-bold text-lg text-ink mb-2">
            Pour les familles et les établissements scolaires
          </div>
          <p className="text-base text-ink-soft mb-4">
            Kalyaro accompagne aussi bien un élève qui travaille seul chez lui qu'une classe entière
            suivie par son enseignant.
          </p>
          <Button variant="ghost" className="w-auto px-8" onClick={() => navigate("/connexion")}>
            Se connecter ou créer un compte
          </Button>
        </Card>
      </div>
    </div>
  );
}
