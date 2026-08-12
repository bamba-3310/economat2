from django.conf import settings as django_settings
from django.db import models


class Branding(models.Model):
    """Per-restaurant display name override (empty → restaurant.name)."""

    restaurant = models.OneToOneField(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='branding',
    )
    restaurant_name = models.CharField(max_length=120, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'branding'

    @classmethod
    def for_restaurant(cls, restaurant):
        obj, _ = cls.objects.get_or_create(restaurant=restaurant)
        return obj

    @property
    def effective_name(self):
        if self.restaurant_name.strip():
            return self.restaurant_name
        if self.restaurant_id:
            return self.restaurant.name
        return django_settings.DEFAULT_RESTAURANT_NAME
