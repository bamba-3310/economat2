#!/bin/env bash
set -euo pipefail

# Script de backup avant déploiement
# À exécuter sur le VPS avant tout déploiement

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Backup avant déploiement - $(date)"
echo "=================================="

BACKUP_DIR="/opt/economat-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"

# Créer le répertoire de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

echo "==> 1. Backup du code source"
cp -r "$ROOT" "$BACKUP_PATH/code"

echo "==> 2. Backup de la base de données PostgreSQL"
docker compose exec -T db pg_dump -U economat economat > "$BACKUP_PATH/database.sql"

echo "==> 3. Backup des volumes Docker"
docker run --rm \
  -v pgdata:/data/pgdata \
  -v "$BACKUP_PATH/volumes:/backup" \
  alpine tar czf /backup/pgdata.tar.gz -C /data pgdata

echo "==> 4. Backup du fichier .env"
cp /opt/economat/.env "$BACKUP_PATH/.env"

echo "==> 5. Informations système"
echo "Git branch: $(git rev-parse --abbrev-ref HEAD)"
echo "Git commit: $(git rev-parse HEAD)"
echo "Docker containers: $(docker compose ps --format json)" > "$BACKUP_PATH/system_info.txt"

echo "==> Backup terminé: $BACKUP_PATH"
echo "Taille du backup: $(du -sh "$BACKUP_PATH" | cut -f1)"

# Garder seulement les 5 derniers backups
cd "$BACKUP_DIR"
ls -t | tail -n +6 | xargs -r rm -rf

echo "==> Nettoyage des anciens backups effectués (gardé les 5 derniers)"
