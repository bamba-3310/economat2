from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models

class UserRole(models.TextChoices):
    ADMIN = 'admin', 'Admin'
    ECONOME = 'econome', 'Econome'
    COOK = 'cook', 'Cook'


# WHY: the frontend has an account-request/approval workflow
# (pending -> active / rejected / disabled) and a granular per-user permission
# list. The model only had `is_active`. WHEN: added during the
# PostgreSQL/Django wiring. `status` defaults to ACTIVE so existing users stay
# usable; `permissions` defaults to [].
class UserStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    ACTIVE = 'active', 'Active'
    REJECTED = 'rejected', 'Rejected'
    DISABLED = 'disabled', 'Disabled'


class UserManager(BaseUserManager):
    # WHEN/WHY: added optional status/permissions params so newly created users
    # (incl. self-registered "pending" accounts) carry these new fields.
    # Previous signature: create_user(self, email, name, role, password).
    def create_user(self, email, name, role, password, status=None, permissions=None):
        if not email:
            raise ValueError('Users must have an email address')
        # WHEN/WHY: login is case-insensitive; store the whole address lowercased
        # (normalize_email only lowercases the domain part) so unique=True can't
        # admit case-variant duplicates.
        user = self.model(
            email=self.normalize_email(email).lower(),
            name=name,
            role=role,
            status=status or UserStatus.ACTIVE,
            permissions=permissions if permissions is not None else [],
        )
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser):
    name = models.CharField(max_length=100)
    email = models.EmailField(max_length=150, unique=True)
    role = models.CharField(max_length=20, choices=UserRole.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # --- New workflow fields (see WHY/WHEN above) ---
    status = models.CharField(max_length=20, choices=UserStatus.choices, default=UserStatus.ACTIVE)
    permissions = models.JSONField(default=list, blank=True)

    # WHY: the profile screen lets a user set an avatar. The cropped image is sent
    # as a (small) data URL; TextField holds it so it actually persists instead of
    # living only in the frontend's memory. WHEN: added with the avatar fix.
    photo_url = models.TextField(null=True, blank=True)

    # WHY: single active session per user. `active_session_id` is the id of the
    # live session (also embedded as the `sid` JWT claim); `session_started_at`
    # records when it began. `session_last_seen` is bumped on each authenticated
    # request (and by the frontend heartbeat) so an idle/abandoned session frees
    # itself after SESSION_IDLE_TIMEOUT instead of staying locked for the whole
    # access-token window. WHEN: last_seen added with the idle-timeout feature.
    active_session_id = models.UUIDField(null=True, blank=True)
    session_started_at = models.DateTimeField(null=True, blank=True)
    session_last_seen = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'users'