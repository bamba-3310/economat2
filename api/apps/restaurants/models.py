from django.conf import settings
from django.db import models


class Restaurant(models.Model):
    """Tenant: Le Carré / Bahia FC (slug used in Host subdomain)."""

    slug = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "restaurants"
        ordering = ["slug"]

    def __str__(self):
        return f"{self.name} ({self.slug})"


class RestaurantMembership(models.Model):
    """Links a user to one or more restaurants (owner can belong to both)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "restaurant_memberships"
        unique_together = (("user", "restaurant"),)

    def __str__(self):
        return f"{self.user_id}@{self.restaurant.slug}"
