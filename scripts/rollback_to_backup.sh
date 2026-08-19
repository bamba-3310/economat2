#!/bin/env bash
set -euo pipefail

# Script de rollback vers un backup précédent
# À utiliser en cas de problème après déploiement

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup_timestamp>"
    echo "Exemple: $0 20260818_143000"
    echo ""
    echo "Backups disponibles:"
    ls -1 /opt/economat-backups/ | grep "^backup_"
    exit 1
fi

BACKUP_TIMESTAMP="$1"
BACKUP_PATH="/opt/economat-backups/backup_$BACKUP_TIMESTAMP"

if [ ! -d "$BACKUP_PATH" ]; then
    echo "ERROR: Backup non trouvé: $BACKUP_PATH"
    exit 1
fi

echo "==> Rollback vers le backup: $BACKUP_TIMESTAMP"
echo "============================================"

# Confirmation
read -p "Êtes-vous sûr de vouloir faire un rollback ? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Rollback annulé"
    exit 0
fi

echo "==> 1. Arrêt des services"
docker compose down

echo "==> 2. Restauration du code source"
rm -rf "$ROOT"/*
cp -r "$BACKUP_PATH/code/"* "$ROOT/"

echo "==> 3. Restauration de la base de données"
docker compose up -d db
sleep 10  # Attendre que PostgreSQL soit prêt
docker compose exec -T db psql -U economat economat < "$BACKUP_PATH/database.sql"

echo "==> 4. Restauration des volumes Docker"
docker run --rm \
  -v pgdata:/data/pgdata \
  -v "$BACKUP_PATH/volumes:/backup" \
  alpine sh -c "cd /data && tar xzf /backup/pgdata.tar.gz"

echo "==> 5. Redémarrage des services"
docker compose up -d

echo "==> Rollback terminé avec succès"
echo "Système restauré vers: $BACKUP_TIMESTAMP"
