# Sauvegardes de la base de données

Toute la valeur de Kalyaro pour un étudiant est dans la base PostgreSQL : sa progression
notion par notion, ses tentatives, ses révisions programmées, ses copies. Les contenus validés
(questions, corrigés, variantes) représentent aussi des heures de relecture humaine. Les perdre
n'est pas acceptable à quelques semaines des examens.

## Objectifs

| | Cible |
|---|---|
| Perte de données maximale acceptable (RPO) | 24 h avec la sauvegarde quotidienne ; quelques minutes si l'hébergeur offre la restauration à un instant donné (PITR) |
| Temps de remise en service (RTO) | moins d'1 h |
| Conservation | 30 jours de sauvegardes quotidiennes + sauvegardes manuelles avant chaque migration risquée |

## Stratégie en trois niveaux

### 1. Sauvegardes natives de l'hébergeur de la base

C'est la première ligne de défense (restauration la plus rapide, souvent à la minute près).
**À vérifier selon l'endroit où se trouve `DATABASE_URL` :**

- **PostgreSQL Render, offre gratuite** : pas de sauvegarde, et la base gratuite expire au bout
  d'une durée limitée. **Ne pas lancer en production sur cette offre.**
- **PostgreSQL Render, offre payante** : sauvegardes quotidiennes et/ou restauration à un instant
  donné selon l'offre — vérifier dans l'onglet *Recovery* de la base.
- **Neon / Supabase / autre** : vérifier la fenêtre de restauration incluse dans l'offre.

Dans tous les cas, la base doit être **dans la même région que l'API** (voir `render.yaml`).

### 2. Sauvegarde logique quotidienne vers Cloudflare R2 (indépendante de l'hébergeur)

Protège contre ce que le niveau 1 ne couvre pas : compte hébergeur perdu ou suspendu, base
supprimée par erreur, changement d'hébergeur, offre sans sauvegarde.

- **Quoi** : `pg_dump` au format *custom* (compressé), vérifié avant envoi (taille minimale,
  présence des tables métier) — `scripts/sauvegarde-db.sh`.
- **Quand** : chaque nuit à 2 h 30 (heure du Bénin) par GitHub Actions
  (`.github/workflows/sauvegarde-db.yml`), gratuit sur un dépôt GitHub. Lancement manuel possible
  (onglet *Actions* → *Sauvegarde base de données* → *Run workflow*, dossier `avant-migration`).
- **Où** : un bucket R2 **dédié** `kalyaro-sauvegardes`, distinct de `kalyaro-uploads`, avec une
  clé d'accès **différente de celle de l'application**. Ainsi, une fuite de la clé de l'API ne
  permet pas d'effacer les sauvegardes.

#### Mise en place (une seule fois, ~15 min)

1. **Cloudflare R2** → *Create bucket* : `kalyaro-sauvegardes`.
2. Dans ce bucket → *Settings* → *Object lifecycle rules* : supprimer les objets du préfixe
   `quotidien/` après **30 jours** (garder `manuel/` et `avant-migration/` sans expiration, et
   les nettoyer à la main).
3. **R2** → *Manage API tokens* → créer un jeton *Object Read & Write* **limité au bucket
   `kalyaro-sauvegardes`**. Noter l'Access Key ID et le Secret.
4. **GitHub** → dépôt → *Settings* → *Secrets and variables* → *Actions* → *New repository
   secret* :

   | Secret | Valeur |
   |---|---|
   | `BACKUP_DATABASE_URL` | l'URL **externe** de la base de production (la même que `DATABASE_URL` sur Render, version « External ») |
   | `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
   | `R2_BACKUP_ACCESS_KEY_ID` | Access Key ID du jeton créé à l'étape 3 |
   | `R2_BACKUP_SECRET_ACCESS_KEY` | Secret du jeton créé à l'étape 3 |

   Variables facultatives (*Variables*, pas *Secrets*) : `R2_BACKUP_BUCKET` si le bucket a un
   autre nom, `PG_CLIENT_VERSION` si le serveur n'est pas en PostgreSQL 17 (mettre sa version
   majeure, ou plus).
5. Onglet *Actions* → *Sauvegarde base de données* → *Run workflow* : vérifier que le job est vert
   et que le fichier apparaît dans le bucket.

Tant que les secrets ne sont pas renseignés, le workflow se termine avec un simple avertissement.

### 3. Fichiers déposés (PDF de cours, photos de copies)

Ils sont dans le bucket R2 `kalyaro-uploads`, pas dans la base. R2 est très durable mais ne
protège pas contre une suppression par l'application ou par erreur. Avant le lancement, ce volume
reste faible : une copie mensuelle manuelle du bucket (par ex. avec `rclone sync`) vers
`kalyaro-sauvegardes/uploads/` suffit. À automatiser quand le volume grandira.

## Restaurer une sauvegarde

> Toujours restaurer **d'abord dans une base neuve**, vérifier, puis basculer `DATABASE_URL`.
> Ne jamais restaurer par-dessus la base de production en service.

```bash
# 1. Récupérer le fichier (ou le télécharger depuis le tableau de bord R2)
aws s3 cp s3://kalyaro-sauvegardes/quotidien/kalyaro-2026-10-20T0130Z.dump . \
  --endpoint-url "$R2_ENDPOINT"

# 2. Restaurer dans une base vide (créée chez l'hébergeur ou en local)
pg_restore --no-owner --no-acl --dbname "$URL_NOUVELLE_BASE" kalyaro-2026-10-20T0130Z.dump

# 3. Vérifier : migrations Prisma à jour et volumes cohérents
DATABASE_URL="$URL_NOUVELLE_BASE" npx prisma migrate status --schema apps/api/prisma/schema.prisma
psql "$URL_NOUVELLE_BASE" -c "select count(*) from users; select count(*) from tentatives_eleve;"
```

4. Mettre la nouvelle URL dans `DATABASE_URL` du service `kalyaro-api` sur Render → redéploiement
   automatique.
5. Prévenir les étudiants si des données récentes (depuis la sauvegarde) ont été perdues.

## Tester la restauration (une fois par mois)

Une sauvegarde jamais restaurée n'est pas une sauvegarde. Le premier lundi du mois : restaurer la
dernière sauvegarde quotidienne dans une base locale jetable (étapes 1 à 3 ci-dessus), vérifier
les comptes de lignes, noter la date du test et la durée dans le tableau ci-dessous.

| Date du test | Sauvegarde restaurée | Durée | Résultat |
|---|---|---|---|
| | | | |

## Avant une migration risquée

Avant toute migration qui modifie ou supprime des données existantes : lancer le workflow à la
main avec le dossier `avant-migration`, attendre qu'il soit vert, puis seulement déployer.
