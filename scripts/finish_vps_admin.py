"""Finish VPS admin setup + HTTPS smoke test. Env: VPS_PASSWORD."""
from __future__ import annotations

import os
import secrets
import ssl
import urllib.request

import paramiko

HOST = os.environ.get("VPS_HOST", "95.217.189.82")
PASSWORD = os.environ["VPS_PASSWORD"]


def main() -> None:
    admin_pass = secrets.token_urlsafe(12)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=PASSWORD, timeout=30)

    script = f"""
from apps.accounts.models import User, UserRole, UserStatus
email = "admin@kovo-app.net"
u = User.objects.filter(email=email).first()
if u is None:
    u = User.objects.create_user(
        email=email,
        name="Admin",
        role=UserRole.ADMIN,
        password="{admin_pass}",
        status=UserStatus.ACTIVE,
    )
    print("CREATED")
else:
    u.set_password("{admin_pass}")
    u.role = UserRole.ADMIN
    u.status = UserStatus.ACTIVE
    u.is_active = True
    u.save()
    print("UPDATED")
print(u.email)
"""
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/create_admin.py", "w") as f:
        f.write(script)
    with sftp.file("/opt/economat/ADMIN_CREDENTIALS.txt", "w") as f:
        f.write(f"admin@kovo-app.net / {admin_pass}\n")
    sftp.close()

    def run(cmd: str, timeout: int = 120) -> int:
        print(">", cmd)
        _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
        out = (stdout.read() + stderr.read()).decode("utf-8", "replace")
        code = stdout.channel.recv_exit_status()
        print(out[-2000:].encode("ascii", "replace").decode("ascii"))
        return code

    run("cd /opt/economat && docker compose exec -T api python manage.py shell < /tmp/create_admin.py")
    run(
        "cd /opt/economat && docker compose exec -T api "
        "python manage.py grant_membership --email admin@kovo-app.net --slug all"
    )
    run("chmod 600 /opt/economat/ADMIN_CREDENTIALS.txt /opt/economat/.env")
    run("cd /opt/economat && docker compose logs --tail=40 caddy")
    ssh.close()

    print("ADMIN_PASS", admin_pass)

    ctx = ssl.create_default_context()
    for url in (
        "https://lecarre.kovo-app.net",
        "https://bahiafc.kovo-app.net",
        "https://lecarre.kovo-app.net/api/branding",
        "https://bahiafc.kovo-app.net/api/branding",
    ):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "bootstrap"})
            with urllib.request.urlopen(req, context=ctx, timeout=45) as resp:
                body = resp.read(120)
                print(url, resp.status, body[:100])
        except Exception as exc:  # noqa: BLE001
            print(url, "ERR", type(exc).__name__, exc)


if __name__ == "__main__":
    main()
