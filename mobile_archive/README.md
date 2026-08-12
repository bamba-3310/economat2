# Économat Mobile

Application Android/iOS (Expo / React Native) pour le scan des lots par QR code.
Elle parle **directement à l'API Django** (`api/`) — PostgreSQL reste l'unique
source de vérité, la synchronisation avec le site web est donc automatique :
les deux clients lisent et écrivent la même base.

## Fonctionnalités

- **Scan** : caméra native (ML Kit via `expo-camera`), lit les étiquettes
  `lecarre://lot/<CODE>` imprimées par le site web. Saisie manuelle en secours.
- **Règles métier** : mêmes décisions que le web (lot expiré bloqué, FEFO
  strict, activation réserve → service, sortie cuisine avec quantité).
- **Stock** : liste des articles avec statut (Critique / Seuil bas / Stable),
  recherche, tirer pour rafraîchir.
- **Auth** : JWT (SimpleJWT) — access 8 h + refresh 7 j, stockés dans le
  Keystore Android (`expo-secure-store`), rafraîchissement automatique sur 401.
- **Bilingue** FR/EN (réglages).

⚠️ Le backend n'autorise qu'**une session active par utilisateur** : se
connecter sur le téléphone déconnecte la session web du même compte.

## Démarrage (développement)

1. **Backend** — le téléphone doit joindre Django sur le réseau local :

   ```bash
   # api/.env : ajouter l'IP LAN de la machine qui héberge Django
   ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.20

   cd api && ./venv/bin/python manage.py runserver 0.0.0.0:8000
   ```

2. **App** — avec [Expo Go](https://expo.dev/go) installé sur le téléphone
   (même Wi-Fi que la machine) :

   ```bash
   cd mobile
   npm install
   npm start          # scanner le QR affiché avec Expo Go
   ```

3. Dans l'app : renseigner l'adresse du serveur
   (`http://192.168.1.20:8000` — l'IP LAN, pas localhost), puis se connecter
   avec un compte existant.

> Note : dans Expo Go, le trafic HTTP clair fonctionne. Pour un APK autonome,
> Android bloque le HTTP clair par défaut — soit servir l'API en HTTPS, soit
> ajouter `expo-build-properties` avec `usesCleartextTraffic: true`.

## APK autonome (installation sans Expo Go)

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

Le profil `preview` produit un APK installable directement sur les téléphones
(pas besoin du Play Store).

## Architecture

```
app/                    # routes (expo-router)
  login.tsx             # serveur + email + mot de passe
  (tabs)/index.tsx      # scan (caméra + carte lot + actions)
  (tabs)/stock.tsx      # liste articles
  (tabs)/settings.tsx   # compte, langue, déconnexion
src/
  api/client.ts         # fetch + Bearer + refresh JWT automatique
  api/endpoints.ts      # appels typés ; protocole d'écriture identique au web
  lib/qr.ts             # parsing lecarre://lot/<CODE>
  lib/stock-rules.ts    # portage de evaluateLotScan (stock-engine.ts du web)
```

Protocole d'écriture (identique à `src/server/stock-service.ts` du web) :

- **Activation** : `PATCH /api/batches/<id>/ {status: in_service}` puis
  `POST /api/movements/ {type: activation}`.
- **Sortie** : `POST /api/movements/ {type: kitchen_exit}` d'abord (Django
  valide et décrémente le stock article atomiquement), puis `PATCH` de la
  quantité du lot.

## Hors-ligne

Non géré (volontairement) : l'app suppose le Wi-Fi du site. Si le besoin
apparaît, le plan est : cache SQLite des référentiels + file d'attente locale
des mouvements avec clé d'idempotence, et un endpoint delta
(`?updated_since=`) côté Django.
