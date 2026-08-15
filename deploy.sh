#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# Check that we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "ERROR: Not on main branch. Current branch: $CURRENT_BRANCH"
    echo "Deployment only allowed from main branch for production safety."
    exit 1
fi

echo "==> git pull (main branch only)"
git pull --ff-only

echo "==> docker compose build"
docker compose build

echo "==> docker compose up -d"
docker compose up -d

echo "==> migrate / seed (api entrypoint already migrates; ensure seed)"
docker compose exec -T api python manage.py seed_restaurants || true

echo "==> done"
docker compose ps
