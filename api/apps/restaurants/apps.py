from django.apps import AppConfig


class RestaurantsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.restaurants"
    label = "restaurants"


default_app_config = "apps.restaurants.apps.RestaurantsConfig"
