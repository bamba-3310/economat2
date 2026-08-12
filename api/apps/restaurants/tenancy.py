from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from .models import RestaurantMembership


def require_restaurant(request):
    restaurant = getattr(request, "restaurant", None)
    if restaurant is None:
        raise ValidationError({"detail": "Restaurant context is required"})
    return restaurant


def assert_restaurant_member(request):
    """Authenticated users must belong to the current restaurant."""
    restaurant = require_restaurant(request)
    user = request.user
    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication required")
    if not RestaurantMembership.objects.filter(
        user=user, restaurant=restaurant
    ).exists():
        raise PermissionDenied("Not a member of this restaurant")
    return restaurant


def for_restaurant(queryset, request):
    """Filter a queryset that has a restaurant FK to the current tenant."""
    restaurant = require_restaurant(request)
    return queryset.filter(restaurant=restaurant)


def get_tenant_object_or_404(model, request, **lookup):
    restaurant = require_restaurant(request)
    try:
        return model.objects.get(restaurant=restaurant, **lookup)
    except model.DoesNotExist as exc:
        raise NotFound() from exc


def user_belongs_to(user, restaurant) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return RestaurantMembership.objects.filter(
        user=user, restaurant=restaurant
    ).exists()
