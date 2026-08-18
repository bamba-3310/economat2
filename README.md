# Le Carré / Bahia FC — Économat & Stock Management

Web application for managing a restaurant's economat (stock room): products,
lots/batches, suppliers, deliveries, stock movements, expiry/threshold alerts,
QR codes, and a consumption dashboard.

**Multi-tenant production** (same codebase, one VPS):

- https://lecarre.kovo-app.net — Le Carré
- https://bahiafc.kovo-app.net — Bahia FC

**VPS Information:**
- IP: `95.217.189.82`
- SSH Access: `ssh bamba@95.217.189.82`
- Deployment Path: `/opt/economat`

See [DEPLOY.md](DEPLOY.md) and [update_acces_distant.md](update_acces_distant.md).
The native Expo app is archived under `mobile_archive/` (tablets use the web
camera scan).

The UI is **bilingual (French / English)** — French is the canonical language
(stored values and the i18n keys are French; English is a translation layer).

## Démarrage rapide (Local Development)

Pour lancer le serveur en local, suivez ces commandes une par une:

### 1. Backend (Django API — port 8000)

```bash
cd api
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
# Éditez .env avec vos informations de base de données
python manage.py migrate
python manage.py runserver
```

### 2. Frontend (Next.js — port 3000)

```bash
# Dans un nouveau terminal
npm install
npm run dev
```

### 3. Créer l'admin local (une fois le backend lancé)

```bash
cd api
.\venv\Scripts\Activate.ps1
python manage.py shell -c "
from apps.accounts.models import User
User.objects.create_user(
    email='admin@economat.sn',
    name='Admin',
    role='admin',
    password='secret123',
)"
```

## Architecture at a glance

```
Browser ──► Next.js app (UI + /api/* adapter routes) ──► Django REST API ──► PostgreSQL
            React 19 / TypeScript / Tailwind            DRF + SimpleJWT      (source of truth)
```

- **Frontend** — Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4.
  The UI is a set of client **components** under `src/components/**` (app shell,
  the four sections — Dashboard / Delivery / Stock / Scan — and the slide-in
  panels), composed by `src/app/page.tsx`, plus server-side **adapter routes**
  under `src/app/api/*`. The adapter routes are a thin proxy in front of Django:
  they forward the logged-in user's JWT (kept in httpOnly cookies) and translate
  between Django's shape (int ids, snake_case, English enums) and the frontend
  domain shape (string ids, camelCase, French values).
- **Design** — a monochrome "maison de luxe" system: white / black / grey, sharp
  corners, hairline borders, uppercase wide-tracked labels, Inter typeface, with
  light **and** dark themes (`html[data-theme]`). The whole design system lives in
  `src/app/globals.css` (tokens + component classes `.card` / `.btn` / `.chip` /
  `.panel` …); shared React primitives are in `src/components/ui/kit.tsx`.
- **Backend** — Django 6 + Django REST Framework + SimpleJWT, backed by
  PostgreSQL. This is the **single source of truth**. Passwords are hashed with
  Argon2, and a custom auth class enforces a single active session per user.

> Note: the Next.js `/api/*` routes used to read/write a local SQLite file
> (`src/server/local-database.ts` keeps that name for compatibility) — it now
> reads exclusively from Django/PostgreSQL.

See [ARCHITECTURE_fr.md](ARCHITECTURE_fr.md) for the detailed (French) architecture,
and [api/curl_requests.md](api/curl_requests.md) for ready-to-run API requests.

## Project layout

```text
EconomatProject/
├── api/                       # Django REST backend (single source of truth)
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/                # settings.py, urls.py, wsgi.py
│   └── apps/
│       ├── accounts/          # users, JWT auth, single-session, roles, approval workflow
│       ├── categories/        # product categories + FEFO/threshold config
│       ├── suppliers/         # suppliers CRUD
│       ├── articles/          # products (name, unit, stock, threshold, shelf life)
│       ├── batches/           # lots (quantity, code, status, expiry date)
│       ├── movements/         # stock movements (entry / exit / activation / correction)
│       ├── alerts/            # low-stock & expiry alerts
│       └── deliveries/        # delivery/receiving workflow (validation creates lots + entries)
│
└── src/                       # Next.js frontend
    ├── app/
    │   ├── page.tsx           # root: data provider (Home) + TopBar + section router
    │   ├── layout.tsx         # root layout, fonts (Inter), i18n + branding providers
    │   ├── globals.css        # monochrome design system (tokens + component classes)
    │   └── api/               # adapter routes proxying Django
    ├── components/            # the UI, by area
    │   ├── ui/kit.tsx         # shared primitives (Eyebrow, StatusChip, Field, UserAvatar…)
    │   ├── LoginView · BottomNav · RotateGuard         # app shell (TopBar lives in page.tsx)
    │   ├── dashboard/ · stock/ · delivery/ · scan/     # the four sections
    │   └── panels/            # PanelShell + Alerts / Users / Settings / Profile slide-ins
    ├── lib/
    │   ├── app-data.tsx       # shared data context (useAppData) + app-level types
    │   ├── i18n.tsx           # FR/EN translation layer
    │   ├── format.ts          # date / lot-code / CSV helpers
    │   ├── hooks.ts           # useCompactMobile
    │   └── stock-engine.ts    # status/alert/scan computation (thresholds, expiry, FEFO)
    ├── server/                # server-only: django client, mappers, services, permissions
    └── types/domain.ts        # frontend domain model
```

## Tech stack

| Layer    | Tools |
|----------|-------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 4, lucide-react |
| QR codes | `qrcode.react` (generate), `jsqr` (scan via camera) |
| Backend  | Django 6.0, Django REST Framework 3.17, SimpleJWT 5.5, django-cors-headers |
| Database | PostgreSQL (`psycopg2-binary`) |
| Auth     | JWT (httpOnly cookies on the Next side), Argon2 password hashing |

## Prerequisites

- Node.js 18+ and npm
- Python 3.12+
- A running PostgreSQL instance

## Admin Accounts

**Production Admin Accounts:**
- Email: `admin@kovo-app.net`
- Password: `CHANGE_ME` (must be changed after first login)
- Role: Admin with access to both restaurants
- Created via Docker command on VPS

**Local Development Admin:**
```bash
cd api
python manage.py shell -c "
from apps.accounts.models import User
User.objects.create_user(
    email='admin@economat.sn',
    name='Admin',
    role='admin',
    password='secret123',
)"
```

## Setup & run (Local Development)

The two halves run as separate processes.

### 1. Backend (Django API — port 8000)

```bash
cd api
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # then fill in the values (see below)
python manage.py migrate
python manage.py runserver        # http://127.0.0.1:8000
```

Create the first admin (run from `api/`, with the venv active):

```bash
python manage.py shell -c "
from apps.accounts.models import User
User.objects.create_user(
    email='admin@economat.sn',
    name='Admin',
    role='admin',
    password='secret123',
)"
```

`api/.env` (see `api/.env.exemple`):

```env
SECRET_KEY=<your-django-secret>
DEBUG=True
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
DB_HOST=localhost
DB_PORT=5432
```

### 2. Frontend (Next.js — port 3000, or 3144 for the preview config)

```bash
npm install
npm run dev                       # http://localhost:3000
```

The frontend talks to Django at `http://127.0.0.1:8000` by default. Override
with the `DJANGO_API_URL` environment variable if Django runs elsewhere.
(IPv4 `127.0.0.1` is used on purpose — Node resolves `localhost` to IPv6 first,
which Django's dev server does not listen on.)

CORS on the backend already allows ports `3000`, `3144`, and `5173`.

## Remote Deployment & Updates

### VPS Access

```bash
# SSH access to VPS
ssh bamba@95.217.189.82

# Navigate to project directory
cd /opt/economat
```

### Remote Update Process

To update the production server from your local machine:

```bash
# 1. Commit and push your changes locally
git add .
git commit -m "Your commit message"
git push

# 2. Trigger remote deployment via SSH
ssh bamba@95.217.189.82 'cd /opt/economat && ./deploy.sh'
```

The `deploy.sh` script:
- Pulls latest changes from git
- Rebuilds Docker images
- Restarts all services
- Runs database migrations
- Seeds restaurant data

### Production Stack

The production environment uses Docker Compose with:
- **db**: PostgreSQL 16 (persistent volume)
- **api**: Django REST API with Gunicorn
- **web**: Next.js frontend
- **caddy**: Reverse proxy with HTTPS (Let's Encrypt)

Services are orchestrated via `docker-compose.yml` and Caddy handles SSL termination for both subdomains.

### Server Access & Architecture

**VPS Details:**
- IP: `95.217.189.82`
- Location: `/opt/economat`
- Firewall: Ports 80, 443, 22 (SSH) open
- Docker: All services containerized

**Multi-tenant Architecture:**
- Single codebase serves both restaurants
- Tenant resolution via subdomain (Host header)
- `lecarre.kovo-app.net` → Le Carré
- `bahiafc.kovo-app.net` → Bahia FC
- Data isolation at database level via `restaurant_id`

## System Architecture & Logic

### Overall Flow

```
Supplier Delivery → Validation → Batch Creation + Stock Entry
                     ↓
                Stock Update
                     ↓
           QR Code Generation/Scan
                     ↓
        Kitchen Consumption → Exit Movement
                     ↓
                Stock Update
                     ↓
     Threshold/Expiry Check → Alerts Generation
                     ↓
              Dashboard Display
```

### Core Components

**Data Model:**
- **Articles**: Products with name, category, unit, stock level, threshold, shelf life
- **Batches**: Individual lots with quantity, code, status, expiry date
- **Movements**: Stock transactions (entry, exit, activation, correction, loss)
- **Alerts**: Automatic notifications for low stock and expiring products
- **Deliveries**: Reception workflow that creates batches and entry movements

**Business Logic:**
- **FEFO (First Expired, First Out)**: Automatic prioritization of expiring batches
- **Multi-lot management**: Multiple batches per product with different expiry dates
- **Threshold alerts**: Low stock warnings configurable per category
- **Expiry tracking**: Automatic alerts for products nearing or past expiration
- **Auto-activation**: Batches automatically activated on delivery (reduces kitchen friction)

**Tenant Isolation:**
- All business data scoped to restaurant via `restaurant_id`
- User membership required per restaurant
- Separate branding per tenant
- Complete data isolation at API level

### Technology Stack

**Frontend (Next.js):**
- UI components organized by functional area
- Real-time stock status calculations
- QR code generation and scanning
- Bilingual interface (FR/EN)
- Responsive design with dark/light themes

**Backend (Django):**
- REST API with JWT authentication
- Single session enforcement per user
- Automatic session cleanup on inactivity
- Membership-based access control
- Database-level data validation

**Infrastructure:**
- Docker containerization
- PostgreSQL persistent storage
- Caddy reverse proxy with SSL
- Multi-domain HTTPS support

## Authentication & roles

- Login (`/api/auth/login`) verifies credentials against Django and stores the
  access/refresh JWTs in httpOnly cookies (`lc_access` / `lc_refresh`). The
  tokens carry their own SimpleJWT lifetimes (access **8 h**, refresh **7 days**),
  but the **cookies are session-scoped**: the browser drops them when it is fully
  closed, so closing the window / quitting the app logs the user out — while a
  plain reload keeps them.
- A custom `SessionJWTAuthentication` enforces a **single active session** per
  user. Login uses **takeover** semantics: the newest login wins and invalidates
  the previous session's token, so you can always sign in again (a crashed/closed
  session can never lock the account out).
- **Inactivity logout**: a session not seen within `SESSION_IDLE_MINUTES`
  (default 15) frees itself server-side; the frontend auto-logs-out after the
  same idle delay and keeps the session alive with an activity heartbeat
  (`/api/auth/ping`) while the user is active.
- New accounts go through an **approval workflow**:
  `pending → active / rejected / disabled`.

If a session lock ever gets stuck (e.g. the DB was edited directly), clear it
from `api/` with:

```bash
python manage.py reset_sessions            # all users
python manage.py reset_sessions --email someone@example.com
```

| Django role | Frontend role  | Default rights |
|-------------|----------------|----------------|
| `admin`     | Admin          | everything |
| `econome`   | Gestionnaire   | stock, lots, thresholds, expiry, deliveries, activation, alerts, categories |
| `cook`      | Agent          | edit stock, activate lot |

## API endpoints (Django)

Base prefix: `/api/`

| Resource    | Path |
|-------------|------|
| Accounts    | `/api/accounts/` — `login/`, `logout/`, `register/`, `me/`, `change-password/`, `token/refresh/`, `<id>/` |
| Categories  | `/api/categories/`, `/api/categories/<id>/` |
| Suppliers   | `/api/suppliers/`, `/api/suppliers/<id>/` |
| Articles    | `/api/articles/`, `/api/articles/<id>/` |
| Batches     | `/api/batches/`, `/api/batches/<id>/` |
| Movements   | `/api/movements/`, `/api/movements/<id>/` |
| Alerts      | `/api/alerts/`, `/api/alerts/<id>/`, `/api/alerts/read-all/` |
| Deliveries  | `/api/deliveries/` |
| System      | `/api/system/branding/` (GET public, PATCH admin), `/api/system/wipe/` (POST admin) |

Copy-paste curl examples for every endpoint live in
[api/curl_requests.md](api/curl_requests.md).

## Reuse for another restaurant (branding)

The displayed name is **not** hard-coded. An admin sets it under **Settings →
Restaurant name** (or `PATCH /api/system/branding/`); it shows on the login
screen, top bar and labels. The default name lives in **one place** —
`DEFAULT_RESTAURANT_NAME` in [api/config/settings.py](api/config/settings.py)
(overridable via the `DEFAULT_RESTAURANT_NAME` env var) — and "restore to
default" reverts to it. The frontend fallback constant in
[src/lib/branding.tsx](src/lib/branding.tsx) should mirror it.

To hand the install over fresh, an admin can **wipe the database** under
**Settings → Danger zone** (or `POST /api/system/wipe/`): this clears all
operational data and non-admin accounts while keeping admin accounts and the
branding. User avatars are stored on the account (`User.photo_url`) and persist.

## Quick Reference

### Production URLs
- Le Carré: https://lecarre.kovo-app.net
- Bahia FC: https://bahiafc.kovo-app.net

### VPS Access
- IP: `95.217.189.82`
- SSH: `ssh bamba@95.217.189.82`
- Path: `/opt/economat`

### Admin Account
- Email: `admin@kovo-app.net`
- Password: `CHANGE_ME` (change after first login)
- Access: Both restaurants

### Update Command
```bash
ssh bamba@95.217.189.82 'cd /opt/economat && ./deploy.sh'
```

### Local Development
```bash
# Backend (Django)
cd api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver  # http://127.0.0.1:8000

# Frontend (Next.js)
npm install
npm run dev  # http://localhost:3000
```

### Key Documentation
- [DEPLOY.md](DEPLOY.md) - VPS deployment procedures
- [update_acces_distant.md](update_acces_distant.md) - Remote access setup
- [ARCHITECTURE_fr.md](ARCHITECTURE_fr.md) - Detailed architecture (French)
- [api/curl_requests.md](api/curl_requests.md) - API examples
