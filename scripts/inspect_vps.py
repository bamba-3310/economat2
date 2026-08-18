"""Inspect VPS state. Env: VPS_PASSWORD."""
import os
import paramiko

HOST = "95.217.189.82"
PASSWORD = os.environ.get("VPS_PASSWORD", "")


def run(ssh, cmd):
    _, stdout, stderr = ssh.exec_command(cmd, timeout=60, get_pty=True)
    out = (stdout.read() + stderr.read()).decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    print(f"\n=== {cmd} (exit {code}) ===")
    print(out[-3500:].encode("ascii", "replace").decode("ascii"))
    return code


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    for user in ("bamba", "root"):
        try:
            ssh.connect(HOST, username=user, password=PASSWORD, timeout=20)
            print(f"Connected as {user}")
            break
        except Exception as exc:
            print(f"{user}: {exc}")
    else:
        return 1

    cmds = [
        "cd /opt/economat && ls -la | head -25",
        "cd /opt/economat && (test -d .git && git status -sb || echo 'NO .git DIRECTORY')",
        "cd /opt/economat && (test -d .git && git remote -v || true)",
        "cd /opt/economat && (test -d .git && git branch -vv || true)",
        "cd /opt/economat && (test -d .git && git log -1 --oneline || true)",
        "cd /opt/economat && docker compose ps -a",
        "cd /opt/economat && head -15 deploy.sh 2>/dev/null || echo NO deploy.sh",
        "curl -s -o /dev/null -w 'lecarre:%{http_code}\\n' https://lecarre.kovo-app.net",
        "curl -s -o /dev/null -w 'bahiafc:%{http_code}\\n' https://bahiafc.kovo-app.net",
        "test -f /opt/economat/.env && echo '.env OK' || echo 'NO .env'",
        "test -f /opt/economat/ADMIN_CREDENTIALS.txt && echo 'ADMIN_CREDS OK' || echo 'NO ADMIN_CREDS'",
        "docker volume ls | grep economat || true",
    ]
    for cmd in cmds:
        run(ssh, cmd)
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
