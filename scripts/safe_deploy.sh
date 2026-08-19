#!/bin/env bash
set -euo pipefail

# Script de déploiement sécurisé avec backup automatique
# À utiliser sur le VPS pour déploiement en production

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> Déploiement sécurisé avec backup automatique"
echo "=============================================="

# 1. Vérifications pré-déploiement
echo "==> 1. Vérifications pré-déploiement"

# Vérifier qu'on est sur main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "ERROR: Pas sur la branche main. Branche actuelle: $CURRENT_BRANCH"
    echo "Le déploiement n'est autorisé que depuis la branche main pour la sécurité en production."
    exit 1
fi

# Vérifier que le working directory est propre
if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: Le working directory n'est pas propre"
    echo "Committez ou stash vos changements avant le déploiement"
    git status
    exit 1
fi

echo "✓ Branche: $CURRENT_BRANCH"
echo "✓ Working directory propre"

# 2. Backup automatique
echo "==> 2. Backup automatique avant déploiement"
./scripts/backup_before_deploy.sh

# 3. Mise à jour du code
echo "==> 3. Mise à jour du code"
git pull --ff-only

# 4. Construction des images Docker
echo "==> 4. Construction des images Docker"
docker compose build

# 5. Arrêt des services
echo "==> 5. Arrêt des services"
docker compose down

# 6. Démarrage des services
echo "==> 6. Démarrage des services"
docker compose up -d

# 7. Migration et seed
echo "==> 7. Migration et seed"
docker compose exec -T api python manage.py migrate --noinput
docker compose exec -T api python manage.py seed_restaurants || true

# 8. Vérification post-déploiement
echo "==> 8. Vérification post-déploiement"
sleep 5

# Vérifier que les services sont en cours d'exécution
if ! docker compose ps | grep -q "Up"; then
    echo "ERROR: Les services ne démarrent pas correctement"
    echo "Considérez un rollback vers le backup précédent"
    docker compose ps
    exit 1
fi

# Vérifier que l'API répond
if ! curl -f -s http://localhost:8000/api/ > /dev/null; then
    echo "WARNING: L'API ne répond pas correctement"
    echo "Vérifiez les logs: docker compose logs api"
fi

echo "==> Déploiement terminé avec succès"
echo "=================================="
docker compose ps

echo ""
echo "Si des problèmes surviennent, utilisez:"
echo "./scripts/rollback_to_backup.sh <timestamp>"
echo ""
echo "Backups disponibles:"
ls -1 /opt/economat-backups/ | grep "^backup_" | tail -5
