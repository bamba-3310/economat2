from django.http import JsonResponse

from .models import Restaurant
from .resolve import resolve_restaurant_slug


class RestaurantTenantMiddleware:
    """
    Resolve the current restaurant from X-Restaurant-Slug or the request Host
    (subdomain). Attaches request.restaurant (or None for unresolved hosts in
    DEBUG when a default slug is configured).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        slug = resolve_restaurant_slug(request)
        restaurant = None
        if slug:
            restaurant = (
                Restaurant.objects.filter(slug=slug, is_active=True).first()
            )
            if restaurant is None:
                return JsonResponse(
                    {"detail": f"Unknown restaurant '{slug}'"},
                    status=404,
                )
        request.restaurant = restaurant
        request.restaurant_slug = slug
        return self.get_response(request)
