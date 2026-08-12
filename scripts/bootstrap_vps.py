"""One-shot VPS bootstrap. Password via env VPS_PASSWORD — do not commit secrets."""
from __future__ import annotations

import io
import os
import secrets
import sys
import tarfile
import time
from pathlib import Path

import paramiko

HOST = os.environ.get("VPS_HOST", "95.217.189.82")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ["VPS_PASSWORD"]
REMOTE_DIR = "/opt/economat"
ROOT = Path(__file__).resolve().parents[1]

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    "venv",
    "api/venv",
    ".git",
    "mobile_archive",
    "__pycache__",
    ".cursor",
}


def should_exclude(path: Path) -> bool:
    rel = path.relative_to(ROOT).as_posix()
    parts = rel.split("/")
    if any(p in EXCLUDE_DIRS or p == "venv" for p in parts):
        return True
    if rel.endswith(".pyc") or rel.endswith(".tsbuildinfo"):
        return True
    if rel.startswith(".next"):
        return True
    return False


def make_tar_bytes() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in ROOT.rglob("*"):
            if path.is_dir():
                continue
            if should_exclude(path):
                continue
            tar.add(path, arcname=path.relative_to(ROOT).as_posix())
    return buf.getvalue()


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"$ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    safe_out = out[-4000:].encode("ascii", errors="replace").decode("ascii")
    safe_err = err[-2000:].encode("ascii", errors="replace").decode("ascii")
    if safe_out.strip():
        print(safe_out)
    if safe_err.strip():
        print(safe_err, file=sys.stderr)
    return code, out, err


def main() -> int:
    print(f"Connecting {USER}@{HOST} …")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    secret = secrets.token_urlsafe(48)
    db_password = secrets.token_urlsafe(24)

    cmds_prep = [
        "export DEBIAN_FRONTEND=noninteractive",
        "apt-get update -y",
        "apt-get install -y docker.io docker-compose-v2 git curl ca-certificates",
        "systemctl enable --now docker",
        "ufw allow OpenSSH || true",
        "ufw allow 80/tcp || true",
        "ufw allow 443/tcp || true",
        "ufw --force enable || true",
        f"mkdir -p {REMOTE_DIR}",
        f"rm -rf {REMOTE_DIR}/* {REMOTE_DIR}/.[!.]* 2>/dev/null || true",
    ]
    code, _, _ = run(ssh, " && ".join(cmds_prep), timeout=900)
    if code != 0:
        print("Prep failed", code)
        return code

    print("Uploading project archive…")
    data = make_tar_bytes()
    print(f"Archive size: {len(data) // 1024} KiB")
    sftp = ssh.open_sftp()
    with sftp.file(f"{REMOTE_DIR}/app.tgz", "wb") as f:
        f.write(data)
    sftp.close()

    env_body = f"""SECRET_KEY={secret}
DEBUG=False
DB_NAME=economat
DB_USER=economat
DB_PASSWORD={db_password}
DB_HOST=db
DB_PORT=5432
ALLOWED_HOSTS=lecarre.kovo-app.net,bahiafc.kovo-app.net,api,localhost
CORS_ALLOWED_ORIGINS=https://lecarre.kovo-app.net,https://bahiafc.kovo-app.net
DEFAULT_RESTAURANT_SLUG=lecarre
DEFAULT_RESTAURANT_NAME=Cuistock
SESSION_IDLE_MINUTES=15
ACCESS_TOKEN_LIFETIME=60
REFRESH_TOKEN_LIFETIME=7
"""
    sftp = ssh.open_sftp()
    with sftp.file(f"{REMOTE_DIR}/.env", "w") as f:
        f.write(env_body)
    sftp.close()

    cmds_deploy = [
        f"cd {REMOTE_DIR}",
        "tar -xzf app.tgz",
        "rm -f app.tgz",
        "chmod +x deploy.sh api/entrypoint.sh || true",
        "docker compose build",
        "docker compose up -d",
    ]
    code, _, _ = run(ssh, " && ".join(cmds_deploy), timeout=1800)
    if code != 0:
        print("Deploy failed", code)
        run(ssh, f"cd {REMOTE_DIR} && docker compose logs --tail=80")
        return code

    # Wait for api healthy-ish
    time.sleep(15)
    run(ssh, f"cd {REMOTE_DIR} && docker compose ps")
    run(
        ssh,
        f"cd {REMOTE_DIR} && docker compose exec -T api python manage.py seed_restaurants",
    )

    admin_pass = secrets.token_urlsafe(12)
    create_admin = f"""
from apps.accounts.models import User, UserRole, UserStatus
email='admin@kovo-app.net'
u=User.objects.filter(email=email).first()
if u is None:
    u=User.objects.create_user(email=email,name='Admin',role=UserRole.ADMIN,password='{admin_pass}',status=UserStatus.ACTIVE)
    print('CREATED')
else:
    u.set_password('{admin_pass}')
    u.role=UserRole.ADMIN
    u.status=UserStatus.ACTIVE
    u.save()
    print('UPDATED')
print(u.email)
"""
    run(
        ssh,
        f"cd {REMOTE_DIR} && docker compose exec -T api python manage.py shell -c {repr(create_admin)}",
    )
    run(
        ssh,
        f"cd {REMOTE_DIR} && docker compose exec -T api python manage.py grant_membership --email admin@kovo-app.net --slug all",
    )

    # Write credentials note only on server (not in git)
    creds = f"admin@kovo-app.net / {admin_pass}\n"
    sftp = ssh.open_sftp()
    with sftp.file(f"{REMOTE_DIR}/ADMIN_CREDENTIALS.txt", "w") as f:
        f.write(creds)
    sftp.close()
    run(ssh, f"chmod 600 {REMOTE_DIR}/ADMIN_CREDENTIALS.txt {REMOTE_DIR}/.env")

    print("\n=== BOOTSTRAP DONE ===")
    print("URLs: https://lecarre.kovo-app.net  https://bahiafc.kovo-app.net")
    print(f"Admin credentials written on server: {REMOTE_DIR}/ADMIN_CREDENTIALS.txt")
    print(admin_pass)  # show once in local console for the operator
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
