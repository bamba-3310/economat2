from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models

class UserRole(models.TextChoices):
    ADMIN = 'admin', 'Admin'
    ECONOME = 'econome', 'Econome'
    COOK = 'cook', 'Cook'


class UserManager(BaseUserManager):
    def create_user(self, email, name, role, password):
        if not email:
            raise ValueError('Users must have an email address')
        user = self.model(
            email=self.normalize_email(email),
            name=name,
            role=role,
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

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'users'