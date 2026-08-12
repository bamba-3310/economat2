from django.core.management.base import BaseCommand

from apps.restaurants.models import Restaurant
from apps.system.models import Branding


DEFAULT_RESTAURANTS = (
    ("lecarre", "Le Carré"),
    ("bahiafc", "Bahia FC"),
)


class Command(BaseCommand):
    help = "Ensure Le Carré and Bahia FC restaurant tenants exist (with branding rows)."

    def handle(self, *args, **options):
        for slug, name in DEFAULT_RESTAURANTS:
            restaurant, created = Restaurant.objects.get_or_create(
                slug=slug,
                defaults={"name": name, "is_active": True},
            )
            Branding.for_restaurant(restaurant)
            verb = "Created" if created else "Exists"
            self.stdout.write(f"{verb}: {restaurant.slug} — {restaurant.name}")
