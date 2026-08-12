# Déploiement VPS — Économat multi-resto

## URLs

- Le Carré : https://lecarre.kovo-app.net
- Bahia FC : https://bahiafc.kovo-app.net

Un seul VPS, une stack Docker (`db` + `api` + `web` + `caddy`). Le tenant est
résolu via le sous-domaine (header `Host` / `X-Restaurant-Slug`).

## Prérequis DNS

Enregistrements **A** :

- `lecarre.kovo-app.net` → IP du VPS
- `bahiafc.kovo-app.net` → IP du VPS

## Premier boot (sur le VPS)

```bash
# Docker
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker "$USER"   # puis re-login

sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

sudo mkdir -p /opt/economat
sudo chown "$USER:$USER" /opt/economat
cd /opt/economat
git clone <URL_DU_REPO> .

cp .env.production.example .env
nano .env   # SECRET_KEY + DB_PASSWORD forts

chmod +x deploy.sh api/entrypoint.sh
./deploy.sh
```

### Compte admin

```bash
docker compose exec api python manage.py shell -c "
from apps.accounts.models import User, UserRole, UserStatus
u = User.objects.create_user(
    email='admin@kovo-app.net',
    name='Admin',
    role=UserRole.ADMIN,
    password='CHANGE_ME',
    status=UserStatus.ACTIVE,
)
print(u.id)
"
docker compose exec api python manage.py grant_membership --email admin@kovo-app.net --slug all
```

Le propriétaire doit avoir une **membership** sur les deux restos pour se
connecter sur les deux URL.

## Mises à jour depuis chez toi

```bash
# après git push depuis ton PC
ssh bamba@95.217.189.82 'cd /opt/economat && ./deploy.sh'
```

## Mobile

L’app Expo native est archivée (`mobile_archive/`). En prod : tablettes /
navigateurs sur les URL ci-dessus (caméra web pour le scan).

## Cloudflare (plus tard)

Mettre les deux sous-domaines en proxy orange une fois HTTPS Caddy stable.
