# Kalyaro

PWA d'apprentissage adaptatif pour les étudiants de l'enseignement supérieur du Bénin (parcours
universitaire Filière → Niveau → UE, et parcours scolaire conservé).

> *Kalyaro dit à chaque étudiant s'il est prêt pour son examen, et le fait progresser là où il
> gagnera le plus de points.*

## Sommaire

- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Base de données](#base-de-données)
- [Lancement en local](#lancement-en-local)
- [Tests](#tests)
- [Déploiement (Render)](#déploiement-render)
- [Règles de contribution](#règles-de-contribution)

## Architecture

Monorepo npm workspaces :

| Dossier | Rôle | Pile |
|---|---|---|
| `apps/api` | API REST | Fastify 5, Prisma 5 (PostgreSQL), Zod, JWT, upload multipart, stockage R2 |
| `apps/web` | PWA étudiant + back-office admin | React 18, Vite 5, React Router 6, TanStack Query 5, Zustand, Tailwind 3, KaTeX |
| `packages/ai-service` | Tous les appels IA : une fonction par usage (`functions/`), un prompt (`prompts/`), un schéma Zod de sortie (`schemas/`) | Gemini (par défaut) ou Anthropic |
| `packages/shared` | Types et énumérations partagés | TypeScript |

Repères dans le code :

- **Moteur de maîtrise** (NON_VU → FRAGILE → ACQUIS_DU_JOUR → CONSOLIDE → DURABLE) :
  `apps/api/src/modules/progression/mastery.ts` (fonction pure, testée).
- **Révisions du jour** (planification, plafond de 15 questions) : `progression/revisions.ts`.
- **Choix de la question suivante** (variantes validées, jamais de contenu IA non relu) :
  `progression/selection-qcm.ts`.
- **Affichage des maths** : `apps/web/src/design-system/MathText.tsx` — prose Unicode, formules
  LaTeX entre `$…$` / `$$…$$`, démo sur `/admin/demo-maths`.
- **Règle d'or IA** : aucun contenu généré n'est montré à un étudiant sans validation humaine
  (file `/admin/validation`), sauf les retours personnalisés sur une réponse (indice, explication).

## Prérequis

- **Node.js ≥ 20** (npm ≥ 10)
- **PostgreSQL 16 ou 17** accessible en local. Au choix :
  - installation native (https://www.postgresql.org/download/) ;
  - Docker :
    ```bash
    docker run -d --name kalyaro-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17
    ```
- Une clé **Gemini** (https://aistudio.google.com/apikey) pour les fonctions IA. Sans clé,
  l'application fonctionne avec les questions déjà publiées, mais les boutons « Générer par IA »
  et la correction des réponses libres renvoient une erreur explicite, et les indices après une
  erreur n'apparaissent pas.
- Facultatif : un bucket **Cloudflare R2** pour l'upload des PDF et des photos de copies.

## Installation

```bash
git clone https://github.com/mentorkidz1-stack/kalyaroapp.git
cd kalyaroapp
npm install
npm run preparer          # client Prisma + compilation de packages/shared et packages/ai-service
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Puis compléter `apps/api/.env` (au minimum `DATABASE_URL` et `JWT_SECRET`).

> `npm run preparer` est indispensable : npm 11 et plus n'exécute plus automatiquement les
> scripts d'installation des dépendances (le client Prisma n'est donc pas généré par
> `npm install`), et l'API importe `shared` et `ai-service` compilés. Le relancer après chaque
> modification de `schema.prisma`, de `packages/shared` ou de `packages/ai-service`.
>
> Sous Windows, si le clonage échoue avec « Filename too long » :
> `git config --global core.longpaths true`, puis recloner.

## Variables d'environnement

### API — `apps/api/.env`

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | oui | URL PostgreSQL, ex. `postgresql://postgres:postgres@localhost:5432/kalyaro?schema=public` |
| `JWT_SECRET` | oui | Secret de signature des sessions **et** de chiffrement des jetons de tentative QCM. Long et aléatoire en production. |
| `PORT` | non | Port HTTP de l'API (défaut `4000`) |
| `VITE_ORIGIN` | oui | Origine(s) autorisée(s) par CORS, séparées par des virgules (ex. `http://localhost:5173`) |
| `AI_PROVIDER` | non | `gemini` (défaut) ou `anthropic` |
| `GEMINI_API_KEY` | pour l'IA | Clé Gemini |
| `GEMINI_MODEL` | non | Modèle Gemini (ex. `gemini-flash-lite-latest`) |
| `ANTHROPIC_API_KEY` | si `AI_PROVIDER=anthropic` | Clé API Anthropic (console.anthropic.com) |
| `ANTHROPIC_MODEL` | non | Modèle Claude |
| `R2_ENDPOINT` | pour les uploads | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | pour les uploads | Clé R2 de l'application |
| `R2_BUCKET_NAME` | pour les uploads | ex. `kalyaro-uploads` |

### Web — `apps/web/.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL de l'API (défaut `http://localhost:4000`). Lue **au moment du build**. |

> Ne jamais committer de fichier `.env` (ils sont dans `.gitignore`).

## Base de données

```bash
# Appliquer toutes les migrations sur une base neuve ou existante
cd apps/api && npx prisma migrate deploy && cd ../..

# Données de démonstration : L1 Sciences économiques et de gestion (2 UE) + une classe de 3e.
# Comptes (mot de passe kalyaro-demo) : admin@kalyaro.bj, etudiant.demo@kalyaro.bj (L1), eleve.demo@kalyaro.bj (3e)
npm run prisma:seed

# Explorer les données
npm run prisma:studio
```

**Créer une nouvelle migration** (après modification de `apps/api/prisma/schema.prisma`) :

```bash
cd apps/api
npx prisma migrate dev --name <nom_explicite>
```

Règles :

- Toute migration est **non destructive** pour les données existantes (valeurs par défaut,
  backfill, renommage d'énumération plutôt que suppression/recréation). Relire le SQL généré :
  Prisma propose parfois de supprimer une valeur d'enum là où un `ALTER TYPE … RENAME VALUE`
  suffit (exemple : `20261004160000_maitrise_durable`).
- La vérifier sur une base vierge **et** sur une base remplie par le seed.
- `prisma migrate dev` refuse de tourner hors d'un terminal interactif (CI, agents). Dans ce cas :
  écrire le SQL à la main dans `prisma/migrations/<horodatage>_<nom>/migration.sql`, appliquer avec
  `prisma migrate deploy`, puis vérifier qu'il ne reste aucun écart :
  ```bash
  npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma
  ```
  (doit afficher `No difference detected.`)

## Lancement en local

Deux terminaux :

```bash
npm run dev:api     # http://localhost:4000  (santé : /health)
```

```bash
npm run dev:web     # http://localhost:5173
```

`packages/shared` et `packages/ai-service` sont consommés compilés (`dist/`) par l'API : après
une modification de l'un d'eux, relancer `npm run preparer` puis redémarrer l'API.

## Tests

```bash
npm test
```

Lance Vitest dans chaque workspace qui en a (`apps/api`, `apps/web`, `packages/ai-service`). Les
tests ne demandent **ni base de données ni clé IA** : la logique métier (maîtrise, révisions,
sélection des questions, jetons anti-rejeu, série de jours, rendu des maths, réparation du LaTeX
renvoyé par l'IA) est isolée dans des fonctions pures.

Avant de livrer une modification :

```bash
npm test
npm run typecheck --workspace apps/api
npm run build --workspace apps/web
```

## Déploiement (Render)

Le fichier `render.yaml` (Blueprint) décrit deux services :

- **`kalyaro-api`** — service web Node. Au build : `npm install`, `prisma generate`, compilation de
  `shared`, `ai-service` et `api`. Au démarrage : `prisma migrate deploy` puis l'API.
- **`kalyaro-web`** — site statique (CDN), réécriture de toutes les routes vers `index.html`.

Première mise en place : Render → *New* → *Blueprint* → choisir ce dépôt, puis renseigner les
secrets demandés (`DATABASE_URL`, `GEMINI_API_KEY`, `R2_*`, `ANTHROPIC_API_KEY` vide si non utilisée).
Ensuite, chaque push sur `main` redéploie.

**Avant le lancement, deux décisions sont à prendre dans `render.yaml`** (commentées dans le fichier) :

1. **L'offre de l'API** : `free` se met en veille après quelques minutes d'inactivité (réveil de
   30 à 60 s pour le premier étudiant). Passer au minimum à `starter`.
2. **La région** : Frankfurt serait la plus proche du Bénin, mais l'offre gratuite de l'API Gemini
   refuse les appels venant de Frankfurt. Options : rester en `oregon`, passer en `virginia` (plus
   proche, accepté par Gemini), ou Frankfurt avec Claude (`AI_PROVIDER=anthropic`) ou une offre
   Gemini payante. La base doit être dans la même région que l'API ; une région ne se change pas
   sur un service existant (il faut en recréer un).

Sauvegardes de la base : voir **[docs/SAUVEGARDES.md](docs/SAUVEGARDES.md)**.

## Règles de contribution

- Jamais de commit direct sur `main` : une branche par chantier `feat/<numéro>-<nom-court>`.
- Commits petits, explicites, **en français**.
- Organisation : `modules/<domaine>/{routes,service,schemas}.ts` côté API, `features/<domaine>/`
  côté web, composants réutilisables dans `design-system/`.
- Validation Zod sur toutes les entrées de l'API.
- Tout nouveau besoin IA = nouvelle fonction dans `packages/ai-service` (prompt + schéma Zod +
  fonction) qui réutilise `BASE_SYSTEM_INSTRUCTIONS`.
- Textes d'interface en français, ton chaleureux, jamais culpabilisant.
