#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> git pull"
git pull --ff-only

echo "==> docker compose build"
docker compose build

echo "==> docker compose up -d"
docker compose up -d

echo "==> migrate / seed (api entrypoint already migrates; ensure seed)"
docker compose exec -T api python manage.py seed_restaurants || true

echo "==> done"
docker compose ps
