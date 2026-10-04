#!/usr/bin/env bash
# Sauvegarde logique de la base PostgreSQL de Kalyaro vers Cloudflare R2.
# Utilisé par .github/workflows/sauvegarde-db.yml — voir docs/SAUVEGARDES.md.
#
# Variables requises :
#   DATABASE_URL           URL de connexion à la base à sauvegarder
#   R2_ENDPOINT            https://<account_id>.r2.cloudflarestorage.com
#   AWS_ACCESS_KEY_ID      clé R2 limitée au bucket de sauvegarde (PAS celle de l'application)
#   AWS_SECRET_ACCESS_KEY
#   R2_BACKUP_BUCKET       bucket dédié aux sauvegardes (ex. kalyaro-sauvegardes)
# Optionnelle :
#   BACKUP_PREFIX          dossier dans le bucket (défaut : quotidien)
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL manquant}"
: "${R2_ENDPOINT:?R2_ENDPOINT manquant}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID manquant}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY manquant}"
: "${R2_BACKUP_BUCKET:?R2_BACKUP_BUCKET manquant}"
PREFIX="${BACKUP_PREFIX:-quotidien}"

# R2 : région fictive « auto », et pas de sommes de contrôle CRC que R2 ne gère pas toujours.
export AWS_DEFAULT_REGION=auto
export AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED
export AWS_RESPONSE_CHECKSUM_VALIDATION=WHEN_REQUIRED

# Taille minimale attendue : une base vide de Kalyaro (schéma seul) fait déjà quelques dizaines
# de Ko. En dessous, le dump est suspect et on préfère échouer bruyamment.
TAILLE_MIN_OCTETS=10000

horodatage="$(date -u +%Y-%m-%dT%H%MZ)"
fichier="kalyaro-${horodatage}.dump"

echo "→ $(pg_dump --version)"
# Format « custom » : compressé, restaurable table par table avec pg_restore.
# --no-owner/--no-acl : restaurable sur n'importe quel hébergeur (rôles différents).
pg_dump --format=custom --no-owner --no-acl --file "$fichier" "$DATABASE_URL"

taille="$(stat -c %s "$fichier")"
if [ "$taille" -lt "$TAILLE_MIN_OCTETS" ]; then
  echo "✗ Dump anormalement petit (${taille} octets) — sauvegarde refusée." >&2
  exit 1
fi

# Vérifie que l'archive est lisible et contient bien les tables métier.
pg_restore --list "$fichier" > sommaire.txt
for table in users progressions_notion tentatives_eleve questions_qcm _prisma_migrations; do
  if ! grep -q "TABLE DATA public ${table} " sommaire.txt; then
    echo "✗ Table ${table} absente du dump — sauvegarde refusée." >&2
    exit 1
  fi
done

destination="s3://${R2_BACKUP_BUCKET}/${PREFIX}/${fichier}"
echo "→ Envoi de ${fichier} (${taille} octets) vers ${destination}"
aws s3 cp "$fichier" "$destination" --endpoint-url "$R2_ENDPOINT" --only-show-errors

echo "✓ Sauvegarde terminée : ${destination}"
