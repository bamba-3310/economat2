from datetime import timedelta

from django.conf import settings as django_settings
from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


# Only write session_last_seen back to the DB at most this often, so we don't do
# a write on every single authenticated request (readDatabase() alone fans out
# ~8 calls per page load).
_LAST_SEEN_WRITE_INTERVAL = timedelta(seconds=60)


# WHY: enforce a single active session per user (the app must block stale,
# concurrent tokens). Each token carries a `sid` claim set at login; here we
# reject any token whose `sid` no longer matches the user's `active_session_id`
# (i.e. the session was logged out, taken over by a newer login, or expired).
#
# WHEN: `sid` check added with the single-session feature; the idle-timeout check
# + last-seen bump added with the inactivity-logout feature so that a session
# left open (browser closed, server killed) frees itself after
# SESSION_IDLE_TIMEOUT instead of staying live for the whole access-token window.
class SessionJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        token_sid = validated_token.get('sid')

        if str(user.active_session_id or '') != str(token_sid or ''):
            raise InvalidToken('Session is no longer active')

        now = timezone.now()
        idle_timeout = django_settings.SESSION_IDLE_TIMEOUT
        # `session_started_at` is the fallback for sessions created before
        # last_seen existed (or never bumped yet).
        last_seen = user.session_last_seen or user.session_started_at

        # Idle too long -> free the session and reject. The next request (or a
        # token refresh) then can't resurrect it, and a fresh login is required.
        if last_seen is not None and (now - last_seen) > idle_timeout:
            user.active_session_id = None
            user.session_started_at = None
            user.session_last_seen = None
            user.save(update_fields=['active_session_id', 'session_started_at', 'session_last_seen'])
            raise InvalidToken('Session expired through inactivity')

        # Keep the active session fresh, but throttle the write.
        if last_seen is None or (now - last_seen) > _LAST_SEEN_WRITE_INTERVAL:
            user.session_last_seen = now
            user.save(update_fields=['session_last_seen'])

        return user
