from django.core.management.base import BaseCommand

from apps.accounts.models import User


# WHY: an escape hatch for the "I shut the server down (Ctrl+C) without logging
# out and the session lock is stuck" case. Clears the single-session fields for
# every user (or one user with --email), so everyone can log in again.
#
# Usage:
#   python manage.py reset_sessions            # clear all sessions
#   python manage.py reset_sessions --email a@b.c
class Command(BaseCommand):
    help = "Clear active single-session locks (run after an unclean shutdown)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            help='Only reset the session for this user (default: all users).',
        )

    def handle(self, *args, **options):
        users = User.objects.all()
        email = options.get('email')
        if email:
            users = users.filter(email=email)

        count = users.update(
            active_session_id=None,
            session_started_at=None,
            session_last_seen=None,
        )
        self.stdout.write(self.style.SUCCESS(f'Reset {count} session(s).'))
