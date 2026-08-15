# EconomatProject2 - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-TENANT RESTAURANT SYSTEM                        │
│                    (Le Carré / Bahia FC - Same Codebase)                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   USER BROWSER   │         │   NEXT.JS APP    │         │  DJANGO REST API │
│  (Mobile/Tablet) │◄────────┤   (Frontend)     │◄────────┤   (Backend)      │
│                  │  HTTP   │  Port 3000/3144  │  HTTP   │   Port 8000      │
└──────────────────┘         └──────────────────┘         └──────────────────┘
                                     │                              │
                                     │                              │
                              ┌──────▼──────┐              ┌───────▼──────┐
                              │   React 19  │              │  PostgreSQL  │
                              │  TypeScript │              │  (Database)  │
                              │  Tailwind 4 │              │              │
                              └─────────────┘              └──────────────┘
```

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         UI Components                                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │
│  │  │Dashboard │  │ Delivery │  │  Stock   │  │   Scan   │               │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │
│  │  │ Alerts   │  │  Users   │  │Settings  │  │ Profile  │               │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   │                                           │
│  ┌────────────────────────────────▼────────────────────────────────────────┐  │
│  │                         Data Context Layer                                │  │
│  │                     (AppDataContext - useAppData)                        │  │
│  │  - State management for all app data                                    │  │
│  │  - API call orchestration                                                │  │
│  │  - Session management                                                   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   │                                           │
│  ┌────────────────────────────────▼────────────────────────────────────────┐  │
│  │                    Adapter Routes (src/app/api/*)                         │  │
│  │  - Thin proxy to Django API                                              │  │
│  │  - JWT forwarding (httpOnly cookies)                                     │  │
│  │  - Data transformation (snake_case ↔ camelCase, int ids ↔ string ids)    │  │
│  │  - Language translation (FR ↔ EN)                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ HTTP + JWT
                                          │
┌─────────────────────────────────────────▼─────────────────────────────────────┐
│                              BACKEND (Django)                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         API Endpoints (/api/*)                          │  │
│  │  /api/accounts/   - Auth, users, sessions                               │  │
│  │  /api/categories/  - Product categories & rules                         │  │
│  │  /api/suppliers/   - Supplier management                                │  │
│  │  /api/articles/    - Products (items)                                   │  │
│  │  /api/batches/     - Lots/batches with QR codes                         │  │
│  │  /api/movements/   - Stock movements (entry/exit/activation)             │  │
│  │  /api/alerts/      - Threshold & expiry alerts                          │  │
│  │  /api/deliveries/  - Delivery/receiving workflow                        │  │
│  │  /api/system/      - Branding & maintenance                            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   │                                           │
│  ┌────────────────────────────────▼────────────────────────────────────────┐  │
│  │                      Django Apps (Business Logic)                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│  │  │ accounts    │  │ categories  │  │ suppliers   │  │ articles    │    │  │
│  │  │ - Users     │  │ - Rules     │  │ - Contacts  │  │ - Products  │    │  │
│  │  │ - Auth      │  │ - FEFO      │  │ - Active    │  │ - Stock     │    │  │
│  │  │ - Sessions  │  │ - Threshold │  │             │  │ - Threshold │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│  │  │ batches     │  │ movements   │  │ alerts      │  │ deliveries  │    │  │
│  │  │ - Lots      │  │ - Entry     │  │ - Threshold │  │ - Workflow  │    │  │
│  │  │ - QR codes  │  │ - Exit      │  │ - Expiry    │  │ - Validation│    │  │
│  │  │ - Status    │  │ - Activate  │  │ - Read status│  │ - History  │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │  │
│  │  ┌─────────────┐  ┌─────────────┐                                          │  │
│  │  │ restaurants │  │ system      │                                          │  │
│  │  │ - Multi-ten │  │ - Branding  │                                          │  │
│  │  │ - Membershp │  │ - Wipe DB   │                                          │  │
│  │  └─────────────┘  └─────────────┘                                          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   │                                           │
│  ┌────────────────────────────────▼────────────────────────────────────────┐  │
│  │                    Security & Middleware Layer                            │  │
│  │  - SessionJWTAuthentication (single active session)                       │  │
│  │  - RestaurantTenantMiddleware (multi-tenant resolution)                   │  │
│  │  - CorsMiddleware (CORS handling)                                         │  │
│  │  - Throttling (login/register rate limits)                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ SQL
                                          │
┌─────────────────────────────────────────▼─────────────────────────────────────┐
│                            PostgreSQL Database                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         Core Tables                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│  │  │ restaurants │  │ users       │  │ restaurant_ │  │ categories  │    │  │
│  │  │ - slug      │  │ - email     │  │ memberships │  │ - name      │    │  │
│  │  │ - name      │  │ - role      │  │ - user_id   │  │ - mode      │    │  │
│  │  │ - is_active │  │ - status    │  │ - rest_id   │  │ - threshold │    │  │
│  │  └─────────────┘  │ - session   │  └─────────────┘  └─────────────┘    │  │
│  │                   │ - permissions│                                        │  │
│  │                   └─────────────┘                                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│  │  │ suppliers  │  │ articles    │  │ batches     │  │ movements   │    │  │
│  │  │ - name      │  │ - name      │  │ - code      │  │ - type      │    │  │
│  │  │ - contact   │  │ - category  │  │ - quantity  │  │ - quantity  │    │  │
│  │  │ - email     │  │ - stock_qt  │  │ - expiry    │  │ - motive    │    │  │
│  │  │ - is_active │  │ - threshold │  │ - status    │  │ - user_id   │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │  │
│  │  ┌─────────────┐  ┌─────────────┐                                        │  │
│  │  │ alerts     │  │ deliveries  │                                        │  │
│  │  │ - type      │  │ - reference │                                        │  │
│  │  │ - message   │  │ - status    │                                        │  │
│  │  │ - read      │  │ - lines     │                                        │  │
│  │  └─────────────┘  └─────────────┘                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           MAIN DATA FLOWS                                    │
└──────────────────────────────────────────────────────────────────────────────┘

1. AUTHENTICATION FLOW
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   User       │───►│  Next.js     │───►│  Django      │───►│  PostgreSQL  │
│   Login      │    │  /api/auth/  │    │  /api/       │    │  users table │
│              │    │  login       │    │  accounts/   │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                       │ JWT tokens               │ Session
                       │ (access/refresh)         │ management
                       │ httpOnly cookies         │ single session
                       └──────────┬───────────────┘ enforcement
                                  │
                         ┌────────▼────────┐
                         │  Session Heart  │
                         │  beat (/ping)   │
                         │  (keep-alive)   │
                         └─────────────────┘

2. DELIVERY WORKFLOW
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   User       │───►│  Next.js     │───►│  Django      │───►│  PostgreSQL  │
│   Creates    │    │  Delivery    │    │  /api/       │    │  deliveries  │
│   Delivery    │    │  View        │    │  deliveries/ │    │  + batches   │
│              │    │              │    │  validate    │    │  + movements │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                             │
                                             │ Creates:
                                             │ - Batch records
                                             │ - Entry movements
                                             │ - Updates stock
                                             │
                          ┌──────────────────┴──────────────────┐
                          │                                     │
                    ┌─────▼─────┐                         ┌─────▼─────┐
                    │  QR Codes  │                         │  Alerts   │
                    │  Generated │                         │  Triggered│
                    └───────────┘                         └───────────┘

3. STOCK MOVEMENT FLOW
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   User       │───►│  Next.js     │───►│  Django      │───►│  PostgreSQL  │
│   Scans QR   │    │  Scan View   │    │  /api/       │    │  movements   │
│   or selects │    │              │    │  movements/  │    │  + batches   │
│   product    │    │              │    │  create      │    │  + articles  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                           │                     │
                           │ Types:              │ Updates:
                           │ - Activation        │ - Stock quantity
                           │ - Kitchen exit      │ - Batch status
                           │ - Correction        │ - Article stock
                           │ - Loss              │
                           └─────────────────────┘

4. ALERT SYSTEM
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   System     │───►│  Stock Engine│───►│  Django      │───►│  PostgreSQL  │
│   Monitors   │    │  (Frontend)  │    │  /api/       │    │  alerts      │
│   Stock      │    │  Calculates │    │  alerts/     │    │              │
│   Levels     │    │  Status      │    │  create      │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                           │                     │
                           │ Checks:             │ Creates alerts for:
                           │ - Low stock         │ - Threshold breach
                           │ - Critical stock    │ - Expiry dates
                           │ - Expiry dates       │ - Soon-to-expire
                           │ - FEFO rules        │
                           └─────────────────────┘
```

## Database Schema Relationships

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE RELATIONSHIPS                                 │
└──────────────────────────────────────────────────────────────────────────────┘

restaurants (multi-tenant)
    │ 1
    │
    ├─────────────────┐
    │ N               │ N
    │                 │
┌───▼────┐      ┌────▼───┐
│ users  │◄─────│restaurant_memberships
└───┬────┘      └────────┘
    │
    │ 1 (created_by)
    │ N
    │
┌───▼──────────────────────────────────────────────────────────────────┐
│                                                                         │
│  categories  ──► articles  ──► batches  ──► movements                │
│     │              │            │            │                          │
│     │              │            │            │                          │
│     │ N            │ N          │ N          │ N                        │
│     │              │            │            │                          │
│     │         ┌────▼────┐   ┌──▼────┐   ┌───▼────┐                     │
│     └─────────│suppliers│   │alerts │   │deliveries│                   │
│                └─────────┘   └───────┘   └─────────┘                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Key Relationships:
- restaurant → categories (1:N) - categories belong to restaurant
- restaurant → articles (1:N) - articles belong to restaurant  
- restaurant → batches (1:N) - batches belong to restaurant
- restaurant → movements (1:N) - movements belong to restaurant
- restaurant → suppliers (1:N) - suppliers belong to restaurant
- restaurant → alerts (1:N) - alerts belong to restaurant
- restaurant → deliveries (1:N) - deliveries belong to restaurant
- category → articles (1:N) - articles belong to category
- article → batches (1:N) - batches belong to article
- article → movements (1:N) - movements reference article
- article → alerts (1:N) - alerts reference article
- supplier → batches (1:N) - batches from supplier
- supplier → deliveries (1:N) - deliveries from supplier
- batch → movements (1:N) - movements reference batch
- user → movements (1:N) - movements created by user
- user → deliveries (1:N) - deliveries validated by user
```

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND COMPONENT STRUCTURE                           │
└──────────────────────────────────────────────────────────────────────────────┘

src/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Main app shell + data provider
│   ├── globals.css             # Design system (tokens + classes)
│   └── api/                    # Adapter routes (proxy to Django)
│       ├── auth/
│       ├── users/
│       ├── categories/
│       ├── suppliers/
│       ├── deliveries/
│       ├── scan/
│       └── stock/
│
├── components/
│   ├── ui/kit.tsx              # Shared primitives (Eyebrow, Field, etc.)
│   ├── LoginView.tsx           # Authentication screen
│   ├── BottomNav.tsx           # Navigation
│   ├── RotateGuard.tsx         # Device rotation handling
│   │
│   ├── dashboard/              # Dashboard section
│   │   └── Dashboard.tsx
│   │
│   ├── delivery/               # Delivery section
│   │   ├── DeliveryView.tsx
│   │   └── QrLabel.tsx
│   │
│   ├── stock/                  # Stock section
│   │   ├── StockView.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── SemiCircleStock.tsx
│   │   └── StockCorrectionPanel.tsx
│   │
│   ├── scan/                   # Scan section
│   │   └── ScanView.tsx
│   │
│   └── panels/                 # Slide-in panels
│       ├── PanelShell.tsx
│       ├── AlertsPanel.tsx
│       ├── UsersPanel.tsx
│       ├── SettingsPanel.tsx
│       └── ProfilePanel.tsx
│
├── lib/
│   ├── app-data.tsx            # AppDataContext + useAppData hook
│   ├── i18n.tsx                # Bilingual support (FR/EN)
│   ├── branding.tsx            # Configurable restaurant name
│   ├── format.ts               # Date/number formatting helpers
│   ├── hooks.ts                # Custom React hooks
│   ├── stock-engine.ts         # Stock status calculation logic
│   └── server/                 # Server-side code
│       ├── django-client.ts    # Django API client
│       ├── mappers.ts          # Data transformation
│       ├── services.ts         # Business logic
│       └── permissions.ts      # Permission checks
│
└── types/
    └── domain.ts               # Frontend domain types
```

## Security Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY LAYERS                                     │
└──────────────────────────────────────────────────────────────────────────────┘

1. AUTHENTICATION
┌──────────────────────────────────────────────────────────────────────────────┐
│  - JWT (SimpleJWT): Access token (8h), Refresh token (7 days)                 │
│  - httpOnly cookies: lc_access, lc_refresh (session-scoped)                  │
│  - Single active session per user (takeover semantics)                       │
│  - Session idle timeout (15 min default) with auto-logout                  │
│  - Activity heartbeat (/api/auth/ping) to keep session alive                 │
│  - Argon2 password hashing                                                     │
└──────────────────────────────────────────────────────────────────────────────┘

2. AUTHORIZATION
┌──────────────────────────────────────────────────────────────────────────────┐
│  Roles:                                                                       │
│  - admin: Full access                                                         │
│  - econome: Stock, lots, thresholds, deliveries, activation, alerts          │
│  - cook: Edit stock, activate lot                                              │
│                                                                               │
│  Granular permissions per user (JSON field)                                   │
│  Account approval workflow: pending → active/rejected/disabled               │
└──────────────────────────────────────────────────────────────────────────────┘

3. MULTI-TENANT ISOLATION
┌──────────────────────────────────────────────────────────────────────────────┐
│  - Restaurant tenant resolved from Host header or X-Restaurant-Slug          │
│  - All data queries scoped to restaurant (foreign key filtering)             │
│  - User membership checked per restaurant                                     │
│  - Restaurant-based URL routing (lecarre.kovo-app.net, bahiafc.kovo-app.net)  │
└──────────────────────────────────────────────────────────────────────────────┘

4. API SECURITY
┌──────────────────────────────────────────────────────────────────────────────┐
│  - CORS configuration for allowed origins                                     │
│  - Rate limiting on login/register endpoints                                  │
│  - All API endpoints require authentication (except public branding)         │
│  - Custom SessionJWTAuthentication validates session IDs                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         TECHNOLOGY STACK                                       │
└──────────────────────────────────────────────────────────────────────────────┘

FRONTEND:
├── Framework: Next.js 15 (App Router)
├── UI: React 19
├── Language: TypeScript 5
├── Styling: Tailwind CSS 4
├── Icons: lucide-react
├── QR Codes: qrcode.react (generate), jsqr (scan)
├── State: React Context (AppDataContext)
└── i18n: Custom FR/EN translation layer

BACKEND:
├── Framework: Django 6.0
├── API: Django REST Framework 3.17
├── Auth: SimpleJWT 5.5
├── CORS: django-cors-headers
├── Static Files: WhiteNoise
└── Password Hashing: Argon2

DATABASE:
├── PostgreSQL (psycopg2-binary)
└── Multi-tenant architecture with restaurant scoping

DEPLOYMENT:
├── Docker containers (frontend + backend)
├── Caddy reverse proxy
├── Multi-tenant VPS hosting
└── Environment-based configuration
```

## Key Business Workflows

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         BUSINESS WORKFLOWS                                    │
└──────────────────────────────────────────────────────────────────────────────┘

1. DELIVERY RECEIVING WORKFLOW
   User creates delivery → Select supplier → Add delivery lines →
   Validate → System creates batches + entry movements → Stock updated →
   QR codes generated → Alerts checked

2. STOCK CONSUMPTION WORKFLOW
   User scans QR code → System identifies lot → User selects action
   (activation/exit) → Movement recorded → Stock updated → 
   Alerts checked → Dashboard metrics updated

3. ALERT MANAGEMENT WORKFLOW
   System monitors stock levels → Calculates status based on rules →
   Creates alerts for threshold/expiry → Users view in Dashboard →
   Mark as read → Corrective actions taken

4. USER MANAGEMENT WORKFLOW
   New user requests account → Status: pending → Admin approves →
   Status: active → User can login → Role-based permissions applied

5. MULTI-TENANT WORKFLOW
   Request comes with restaurant identifier → Middleware resolves tenant →
   All queries scoped to restaurant → User membership verified →
   Restaurant-specific data returned
```

This architecture provides a complete, production-ready restaurant economat
management system with multi-tenant support, comprehensive stock tracking,
QR code integration, and real-time alerting.
