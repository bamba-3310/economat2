# Projet : Système de gestion d'économat — React + Django REST + PostgreSQL

## Contexte

Application web de gestion d'économat pour restaurant.

Objectif :

- Gérer les entrées de stock
- Gérer les sorties de stock
- Suivre les fournisseurs
- Générer et scanner des QR Codes
- Surveiller les seuils critiques
- Produire des statistiques de consommation

---

# Architecture technique

## Frontend

Technologies :

- React
- Vite
- React Router
- Axios
- React Query
- Tailwind CSS (ou Bootstrap)

Responsabilités :

- Affichage des écrans
- Gestion des formulaires
- Consommation de l'API Django
- Dashboard
- Scan QR

---

## Backend

Technologies :

- Django
- Django REST Framework
- JWT Authentication
- PostgreSQL

Responsabilités :

- Authentification
- Gestion métier
- Validation des données
- Gestion du stock
- Calcul des alertes
- Génération des statistiques

---

## Base de données

PostgreSQL

Tables principales :

- utilisateurs
- categories
- fournisseurs
- articles
- mouvements
- alertes

---

# Structure du projet

```text
economat/
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── routes/
│   │   ├── hooks/
│   │   ├── contexts/
│   │   └── App.jsx
│   │
│   └── package.json
│
├── api/
│   ├── manage.py
│   │
│   ├── config/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   │
│   ├── apps/
│   │   ├── accounts/
│   │   ├── fournisseurs/
│   │   ├── stock/
│   │   ├── mouvements/
│   │   ├── alertes/
│   │   └── dashboard/
│   │
│   └── requirements.txt
│
└── docs/
```

---

# Modules Backend

## Accounts

- Utilisateurs
- Authentification JWT
- Gestion des rôles

Rôles :

- Admin
- Économe
- Cuisinier

---

## Stock

Gestion :

- Articles
- Catégories
- Quantités
- Seuils minimums
- Dates de péremption

---

## Fournisseurs

Gestion :

- CRUD fournisseurs
- Historique des livraisons

---

## Mouvements

Types :

- Entrée
- Sortie cuisine
- Sortie vente liquide
- Perte

Chaque mouvement conserve :

- utilisateur
- article
- quantité
- date
- motif

---

## Alertes

Types :

- Stock faible
- Péremption proche

---

## Dashboard

Statistiques :

- Valeur totale du stock
- Consommation mensuelle
- Produits les plus utilisés
- Produits en alerte

---

# Endpoints principaux

/api/auth/
/api/users/
/api/categories/
/api/fournisseurs/
/api/articles/
/api/mouvements/
/api/alertes/
/api/dashboard/

---

# Flux général

Réception fournisseur
↓
Création mouvement d'entrée
↓
Mise à jour stock
↓
Génération QR
↓
Consommation cuisine
↓
Création mouvement de sortie
↓
Mise à jour stock
↓
Vérification alertes
↓
Dashboard
```
:::

Pour la suite, je te recommande de créer immédiatement les applications Django suivantes :

```bash
python manage.py startapp accounts
python manage.py startapp stock
python manage.py startapp fournisseurs
python manage.py startapp mouvements
python manage.py startapp alertes
python manage.py startapp dashboard
```

Ça correspond pratiquement à toutes les fonctionnalités de ton ancien cahier des charges, mais avec une architecture propre React + Django REST.