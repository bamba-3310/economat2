# update_acces_distant — Accès distant VPS & multi-resto

Document de suivi de la mise à jour (août 2026) : passage d’un hébergement local
à un **VPS cloud multi-tenant** pour **Le Carré** et **Bahia FC**.

## Objectifs

1. Accès distant sans PC allumé au restaurant : URLs HTTPS publiques.
2. Deux restaurants isolés sur **un** VPS / **une** stack Docker.
3. Mises à jour depuis chez soi via `git push` + `./deploy.sh` en SSH.
4. Activation des lots automatisée (moins de friction en cuisine).
5. Clients = navigateur / tablettes (app mobile native archivée).

## Ce qui a été fait dans le code

### Multi-tenant

- Nouvelle app Django `api/apps/restaurants/` :
  - modèles `Restaurant`, `RestaurantMembership`
  - middleware `RestaurantTenantMiddleware` (Host / `X-Restaurant-Slug`)
  - commandes `seed_restaurants`, `grant_membership`
- Champ `restaurant_id` sur : articles, catégories, fournisseurs, lots,
  livraisons, mouvements, alertes ; branding **par** resto.
- Seed : slugs `lecarre` et `bahiafc`.
- Filtrage de toutes les API métier par resto + contrôle de membership au login.
- Next.js (`src/server/django.ts`) envoie `X-Restaurant-Slug` dérivé du Host
  (`lecarre.kovo-app.net` / `bahiafc.kovo-app.net`).

### Activation automatique des lots

- Validation livraison → lots créés en `in_service` (plus en `reserve`).
- Sortie cuisine sur un ancien lot `reserve` → passage auto en service.
- Front : `canActivate` désactivé dans `stock-engine` (plus d’étape manuelle).

### Infra Docker

- `docker-compose.yml` : Postgres + Django/Gunicorn + Next.js + Caddy.
- `Caddyfile` : HTTPS Let’s Encrypt pour les deux sous-domaines → `web:3000`.
- Django **non exposé** sur Internet (réseau Docker interne uniquement).
- `deploy.sh`, `.env.production.example`, `DEPLOY.md`.

### Mobile

- Déjà archivé sous `mobile_archive/` (hors déploiement Docker).

## Accès distant (phase 1)

| Restaurant | URL |
|------------|-----|
| Le Carré | https://lecarre.kovo-app.net |
| Bahia FC | https://bahiafc.kovo-app.net |

Protection : **Internet + login** (JWT, comptes approuvés, membership par resto).
Cloudflare (WAF / proxy) est **prévu plus tard**, pas dans ce déploiement initial.

## Mises à jour à distance

1. Développer / committer / `git push` depuis ton PC.
2. Sur le VPS : `ssh … 'cd /opt/economat && ./deploy.sh'`
   (`git pull` → rebuild images → restart → seed restos).

## Commits (rollback)

Les étapes ont été commités séparément sur la branche de travail pour permettre
un rollback ciblé (`git revert` / `git reset` selon besoin) :

1. Multi-tenant + activation auto des lots
2. Stack Docker / Caddy / deploy
3. Ce document `update_acces_distant.md`

## Sécurité — actions requises de ton côté

- **Change immédiatement** les mots de passe SSH du VPS (ils ont été partagés
  en clair dans le chat). Préfère une **clé SSH** et désactive l’auth par mot
  de passe.
- Ne committe **jamais** le fichier `.env` du serveur.
- Utilise un `SECRET_KEY` et un `DB_PASSWORD` longs et uniques dans `.env`.

## Bootstrap VPS (résumé)

Voir [DEPLOY.md](DEPLOY.md) pour la procédure complète (Docker, UFW, clone,
admin + `grant_membership --slug all`).

IP cible : `95.217.189.82` — domaines `lecarre.kovo-app.net` /
`bahiafc.kovo-app.net`.

### Statut au moment du déploiement

- Stack Docker up : `db`, `api` (Gunicorn), `web` (Next.js), `caddy` (HTTPS Let’s Encrypt).
- Certificats obtenus pour les deux sous-domaines.
- Branding distinct vérifié : Le Carré / Bahia FC via `/api/branding`.
- Compte admin créé avec memberships sur **les deux** restos.
- Identifiants admin stockés **uniquement sur le serveur** :
  `/opt/economat/ADMIN_CREDENTIALS.txt` (chmod 600) — pas dans git.

### Mises à jour ultérieures

Comme le dépôt sur le VPS a été initialisé par archive (pas un `git clone`),
pour les prochains déploiements soit :

1. `git init` + remote sur `/opt/economat` puis utiliser `./deploy.sh`, **ou**
2. re-pousser une archive / rsync depuis ton PC.

Recommandé : configurer un clone Git avec deploy key lecture seule, puis
`./deploy.sh`.
