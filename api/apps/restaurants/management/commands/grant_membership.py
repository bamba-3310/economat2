from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.restaurants.models import Restaurant, RestaurantMembership


class Command(BaseCommand):
    help = "Attach a user (by email) to one or all restaurants."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument(
            "--slug",
            default="all",
            help="Restaurant slug, or 'all' for lecarre+bahiafc",
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError(f"No user with email {email}")

        if options["slug"] == "all":
            restaurants = Restaurant.objects.filter(slug__in=["lecarre", "bahiafc"])
        else:
            restaurants = Restaurant.objects.filter(slug=options["slug"])
            if not restaurants.exists():
                raise CommandError(f"Unknown restaurant slug {options['slug']}")

        for restaurant in restaurants:
            _, created = RestaurantMembership.objects.get_or_create(
                user=user, restaurant=restaurant
            )
            verb = "Added" if created else "Exists"
            self.stdout.write(f"{verb}: {email} → {restaurant.slug}")
