# Projet « Economat Project » — Système de gestion d'économat

## Contexte

Application web de gestion d'économat (réserve de stock) pour restaurant.

Objectifs :

- Gérer les entrées et sorties de stock
- Suivre les lots (batches) et leurs dates de péremption
- Gérer les fournisseurs et les livraisons (réception)
- Générer et scanner des QR Codes
- Surveiller les seuils critiques et les péremptions (alertes)
- Produire un tableau de bord de consommation

L'interface est **bilingue (français / anglais)** : le français reste la langue
**canonique** (les valeurs stockées et les clés de traduction sont en français ;
l'anglais est une couche de traduction par-dessus).

---

# Architecture technique

```
Navigateur ──► App Next.js (UI + routes /api/* adaptateurs) ──► API Django REST ──► PostgreSQL
               React 19 / TypeScript / Tailwind                 DRF + SimpleJWT     (source de vérité)
```

Deux processus séparés :

1. **Frontend Next.js** — sert l'interface **et** des routes adaptateurs.
2. **Backend Django REST** — la **seule source de vérité**, adossée à PostgreSQL.

## Frontend

Technologies :

- Next.js 15 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- lucide-react (icônes)
- `qrcode.react` (génération QR) et `jsqr` (lecture QR via la caméra)

Responsabilités :

- Affichage des écrans — interface **découpée en composants** sous
  `src/components/**` (coquille d'application, les quatre sections Dashboard /
  Livraison / Stock / Scan, et les panneaux latéraux), composés par
  `src/app/page.tsx`.
- Système de **design monochrome** (« maison de luxe » : blanc / noir / gris,
  angles vifs, filets fins, libellés en capitales espacées, police Inter, thèmes
  clair **et** sombre via `html[data-theme]`) — défini dans `src/app/globals.css` ;
  primitives partagées dans `src/components/ui/kit.tsx`.
- Contexte de données partagé (`useAppData`, `src/lib/app-data.tsx`) — le provider
  réel vit dans `Home` (`page.tsx`) et appelle les routes `/api/*`.
- Gestion des formulaires
- Calcul des statuts / alertes / décisions de scan côté client (`src/lib/stock-engine.ts`)
- Internationalisation FR/EN (`src/lib/i18n.tsx`)
- Scan / génération de QR Codes

### Routes adaptateurs (`src/app/api/*`)

Ces routes côté serveur Next.js sont un **proxy mince devant Django**. Elles :

- transmettent le JWT de l'utilisateur connecté (conservé dans des cookies
  httpOnly `lc_access` / `lc_refresh`) ;
- traduisent entre la forme Django (id entiers, snake_case, enums en anglais) et
  la forme du domaine frontend (id chaînes, camelCase, valeurs françaises) via
  `src/server/mappers.ts` ;
- rafraîchissent automatiquement l'access token sur un 401.

> Historique : ces routes lisaient/écrivaient autrefois un fichier SQLite local.
> Le module `src/server/local-database.ts` garde ce nom par compatibilité, mais
> il lit désormais exclusivement depuis Django/PostgreSQL.

Routes présentes : `auth/login`, `auth/logout`, `auth/password`, `auth/ping`,
`users`, `categories`, `suppliers`, `deliveries`, `scan`, `backup`, `health`,
`server-info`, et `stock/` (+ `stock/product`, `stock/lot`, `stock/movement`,
`stock/correction`).

---

## Backend

Technologies :

- Django 6.0
- Django REST Framework 3.17
- SimpleJWT 5.5 (authentification JWT)
- django-cors-headers
- PostgreSQL (`psycopg2-binary`)
- Hachage des mots de passe avec **Argon2**

Responsabilités :

- Authentification JWT + **session unique** par utilisateur
  (`apps.accounts.authentication.SessionJWTAuthentication`)
- Gestion métier et validation des données
- Gestion du stock, des lots et des mouvements
- Calcul / persistance des alertes
- Workflow de livraison (la validation crée les lots et les mouvements d'entrée)

CORS autorisé pour les origines `localhost:3000`, `localhost:3144` et
`localhost:5173`.

JWT : access **8 h**, refresh **7 jours** (cf. `SIMPLE_JWT` dans
`api/config/settings.py`). Les **cookies** côté Next.js sont toutefois *de
session* (sans `maxAge`) : le navigateur les supprime à sa fermeture, donc fermer
la fenêtre / quitter l'app déconnecte l'utilisateur (un simple rechargement les
conserve).

**Session unique + déconnexion auto :**

- Connexion en mode **takeover** : la connexion la plus récente l'emporte et
  invalide le token de la session précédente. On peut donc **toujours** se
  reconnecter — une session fermée/plantée ne bloque plus le compte.
- **Inactivité** : une session non revue dans `SESSION_IDLE_TIMEOUT`
  (`SESSION_IDLE_MINUTES`, 15 min par défaut) se libère côté serveur ; le
  frontend déconnecte après le même délai d'inactivité et maintient la session
  active via un *heartbeat* (`/api/auth/ping`) tant que l'utilisateur agit.
- Commande de secours : `python manage.py reset_sessions` (efface les verrous de
  session après un arrêt brutal du serveur).

---

## Base de données

PostgreSQL — tables principales :

- `users` (accounts)
- categories
- suppliers
- articles (produits)
- batches (lots)
- movements (mouvements)
- alerts (alertes)
- deliveries (livraisons)

---

# Structure du projet

```text
EconomatProject/
│
├── api/                       # Backend Django REST
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── apps/
│       ├── accounts/
│       ├── categories/
│       ├── suppliers/
│       ├── articles/
│       ├── batches/
│       ├── movements/
│       ├── alerts/
│       └── deliveries/
│
└── src/                       # Frontend Next.js
    ├── app/
    │   ├── page.tsx           # racine : provider de données (Home) + TopBar + routeur de sections
    │   ├── layout.tsx         # layout racine, polices (Inter), providers i18n + branding
    │   ├── globals.css        # système de design monochrome (tokens + classes de composants)
    │   └── api/               # routes adaptateurs (proxy Django)
    ├── components/            # l'interface, par zone
    │   ├── ui/kit.tsx         # primitives partagées (Eyebrow, StatusChip, Field, UserAvatar…)
    │   ├── LoginView · BottomNav · RotateGuard         # coquille (TopBar est dans page.tsx)
    │   ├── dashboard/ · stock/ · delivery/ · scan/     # les quatre sections
    │   └── panels/            # PanelShell + Alertes / Utilisateurs / Paramètres / Profil
    ├── lib/
    │   ├── app-data.tsx       # contexte de données partagé (useAppData) + types applicatifs
    │   ├── i18n.tsx
    │   ├── format.ts          # helpers date / code-lot / CSV
    │   ├── hooks.ts           # useCompactMobile
    │   └── stock-engine.ts
    ├── server/                # code serveur : client Django, mappers, services, permissions
    └── types/domain.ts        # modèle de domaine frontend
```

---

# Modules Backend (Django apps)

## accounts

- Utilisateurs (modèle `User`, table `users`)
- Authentification JWT (login / logout / refresh / me / change-password)
- Session unique par utilisateur, mode takeover (`active_session_id`, claim
  `sid`), avec déconnexion sur inactivité (`session_last_seen`)
- Workflow d'inscription/validation : `pending → active / rejected / disabled`
- Liste de permissions granulaires par utilisateur (`permissions` JSON)

Rôles (clé Django → valeur frontend) :

| Django    | Frontend       |
|-----------|----------------|
| `admin`   | Admin          |
| `econome` | Gestionnaire   |
| `cook`    | Agent          |

## categories

- Catégories de produits
- Configuration FEFO / multi-lots / standard
- Seuils par défaut et critiques, jours « bientôt expiré », expiration automatique

## suppliers

- CRUD fournisseurs (contact, email, téléphone, actif/inactif)

## articles

- Produits : nom, catégorie, unité, quantité en stock, seuil minimum, durée de
  conservation (`shelf_life_days`)

## batches

- Lots : quantité, quantité initiale, code, statut (`reserve` / `in_service`),
  date de péremption

## movements

Types de mouvement :

- `entry` (entrée)
- `kitchen_exit` (sortie cuisine)
- `activation` (mise en service d'un lot)
- `correction`
- `loss` (perte)

Chaque mouvement conserve : utilisateur, article, lot, quantité, date, motif.

## alerts

Types :

- Stock faible / critique (seuil)
- Péremption proche ou dépassée

Endpoints : liste, détail (marquer comme lu), « tout marquer comme lu ».

## deliveries

- Workflow de livraison / réception (« Livraison »)
- La **validation** d'une livraison crée les lots et les mouvements d'entrée
- Le détail des lignes validées est conservé en JSON (historique / impression)

> Remarque : un dossier `api/apps/dashboard/` existe mais n'est pas branché
> (absent de `INSTALLED_APPS`, sans `urls.py`). Le tableau de bord est calculé
> côté frontend à partir des données Django et du moteur de stock.

---

# Endpoints principaux (préfixe `/api/`)

```
/api/accounts/        login/ logout/ register/ me/ change-password/ token/refresh/ <id>/
/api/categories/      <id>/
/api/suppliers/       <id>/
/api/articles/        <id>/
/api/batches/         <id>/
/api/movements/       <id>/
/api/alerts/          <id>/ read-all/
/api/deliveries/
```

Des exemples curl prêts à l'emploi se trouvent dans
[api/curl_requests.md](api/curl_requests.md).

---

# Flux général

```
Réception fournisseur (Livraison)
        ↓
Validation de la livraison  ──► création des lots (batches)
        ↓                        + mouvements d'entrée
Mise à jour du stock
        ↓
Génération / scan QR
        ↓
Consommation cuisine ──► mouvement de sortie
        ↓
Mise à jour du stock
        ↓
Vérification des seuils / péremptions ──► alertes
        ↓
Tableau de bord
```
