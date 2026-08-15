# Création compte Admin Bamba

## Instructions pour créer le compte admin sur le VPS

Se connecter au VPS et exécuter les commandes suivantes:

```bash
# Se connecter au VPS
ssh bamba@95.217.189.82

# Naviguer vers le projet
cd /opt/economat

# Créer le compte admin
docker compose exec api python manage.py shell -c "
from apps.accounts.models import User, UserRole, UserStatus
u = User.objects.create_user(
    email='bamba@kovo-app.net',
    name='Bamba',
    role=UserRole.ADMIN,
    password='132435',
    status=UserStatus.ACTIVE,
)
print(f'User created with ID: {u.id}')
"

# Donner les accès aux deux restaurants
docker compose exec api python manage.py grant_membership --email bamba@kovo-app.net --slug all
```

## Important - Sécurité

⚠️ **CHANGEZ IMMÉDIATEMENT LE MOT DE PASSE** après la première connexion!

Le mot de passe temporaire `132435` doit être changé dès que possible.

## Fonctionnement des sessions multiples

### Comportement actuel du système
- **OUI**, si plusieurs personnes essaient de se connecter au même compte, elles se font déconnecter
- Le système utilise un mécanisme de "takeover" (prise de contrôle)
- La connexion la plus récente gagne et invalide toutes les sessions précédentes
- C'est géré par `SessionJWTAuthentication` dans `api/apps/accounts/authentication.py`

### Détail technique
Chaque connexion génère un nouveau `active_session_id` dans la table users:
- Quand un utilisateur se connecte, un nouveau session ID est créé
- Tous les tokens JWT précédents avec l'ancien session ID sont invalidés
- Les utilisateurs avec des anciens tokens sont déconnectés automatiquement

### Pourquoi ce comportement?
- Sécurité: empêche l'utilisation simultanée du même compte
- Prévient les conflits de données
- Évite les problèmes de session zombie

## Système de Membership

### Comment ça marche
1. **Table RestaurantMembership**: lie un utilisateur à un ou plusieurs restaurants
2. **Vérification au login**: le middleware vérifie que l'utilisateur a un membership pour le restaurant demandé
3. **Multi-tenant**: chaque restaurant (lecarre, bahiafc) a ses propres données isolées

### Sans membership
- **NON**, le logiciel n'est PAS accessible sans membership
- L'utilisateur ne peut pas se connecter
- Le middleware `RestaurantTenantMiddleware` bloque l'accès
- Message d'erreur: "User does not have access to this restaurant"

### Comment retirer un membership (admin)
```bash
# Sur le VPS
docker compose exec api python manage.py shell -c "
from apps.accounts.models import User
from apps.restaurants.models import RestaurantMembership

# Retirer l'accès à un restaurant spécifique
user = User.objects.get(email='user@example.com')
RestaurantMembership.objects.filter(user=user, restaurant__slug='lecarre').delete()
print('Membership removed for lecarre')

# OU retirer tous les accès
RestaurantMembership.objects.filter(user=user).delete()
print('All memberships removed')
"
```

### Commande management Django
Il existe aussi une commande pour gérer les memberships:
```bash
# Donner accès à un restaurant spécifique
docker compose exec api python manage.py grant_membership --email user@example.com --slug lecarre

# Donner accès à tous les restaurants
docker compose exec api python manage.py grant_membership --email user@example.com --slug all
```

## Dépannage du déploiement VPS

### Pourquoi `./deploy.sh` n'a pas fonctionné?

Le problème vient du fait que le dépôt Git sur le VPS n'a pas été correctement initialisé:

#### Cause probable
1. Le dépôt a été créé par archive (pas `git clone`)
2. Pas de remote Git configuré
3. La commande `git pull` dans `deploy.sh` échoue

#### Solution
Sur le VPS, exécuter:

```bash
cd /opt/economat

# Initialiser Git si ce n'est pas déjà fait
git init

# Ajouter le remote GitHub
git remote add origin https://github.com/bamba-3310/economat2.git

# Configurer la branche main
git branch -M main

# Récupérer les changements
git pull origin main

# S'assurer que le script est exécutable
chmod +x deploy.sh

# Maintenant le déploiement devrait fonctionner
./deploy.sh
```

### Sécurité SSH supplémentaire
Pour plus de sécurité, configurez une clé SSH:

```bash
# Sur votre machine locale
ssh-keygen -t ed25519 -C "bamba@kovo-app.net"

# Copier la clé publique sur le VPS
ssh-copy-id bamba@95.217.189.82

# Désactiver l'auth par mot de passe sur le VPS
sudo nano /etc/ssh/sshd_config
# Changer: PasswordAuthentication no
sudo systemctl restart ssh
```

## Résumé des changements effectués

1. ✅ Merge de `cursor/dark-mode-dropdown-menus` vers `main`
2. ✅ Push des changements sur GitHub (branche main)
3. ✅ Ajout de l'ARCHITECTURE_DIAGRAM.md au projet
4. ✅ Correction du .gitignore
5. ✅ Sécurisation du deploy.sh (branche main uniquement)
6. ✅ Documentation complète pour la création du compte admin

## Prochaines étapes recommandées

1. **Créer le compte admin bamba@kovo-app.net** sur le VPS
2. **Changer le mot de passe** immédiatement après création
3. **Configurer Git correctement** sur le VPS pour les déploiements futurs
4. **Tester le déploiement** avec `./deploy.sh`
5. **Sécuriser l'accès SSH** avec des clés SSH
