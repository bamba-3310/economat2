from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.permissions import IsAdmin
from apps.accounts.models import User, UserRole
from apps.articles.models import Article
from apps.batches.models import Batch
from apps.movements.models import Movement
from apps.alerts.models import Alert
from apps.categories.models import Category
from apps.suppliers.models import Supplier
from apps.deliveries.models import Delivery
from apps.restaurants.models import RestaurantMembership
from apps.restaurants.tenancy import assert_restaurant_member, require_restaurant

from .models import Branding
from .serializers import BrandingSerializer


class BrandingView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated(), IsAdmin()]

    def get(self, request):
        restaurant = require_restaurant(request)
        return Response(BrandingSerializer(Branding.for_restaurant(restaurant)).data)

    def patch(self, request):
        restaurant = assert_restaurant_member(request)
        branding = Branding.for_restaurant(restaurant)
        if request.data.get('restore'):
            branding.restaurant_name = ''
        else:
            name = request.data.get('name')
            if name is None:
                return Response({'detail': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)
            branding.restaurant_name = str(name).strip()[:120]
        branding.save()
        return Response(BrandingSerializer(branding).data)


class WipeDatabaseView(APIView):
    """Wipe operational data for the current restaurant only."""

    permission_classes = [IsAuthenticated, IsAdmin]

    @transaction.atomic
    def post(self, request):
        restaurant = assert_restaurant_member(request)

        Movement.objects.filter(restaurant=restaurant).delete()
        Alert.objects.filter(restaurant=restaurant).delete()
        Delivery.objects.filter(restaurant=restaurant).delete()
        Batch.objects.filter(restaurant=restaurant).delete()
        Article.objects.filter(restaurant=restaurant).delete()
        Supplier.objects.filter(restaurant=restaurant).delete()
        Category.objects.filter(restaurant=restaurant).delete()

        # Remove non-admin memberships for this restaurant. Delete the user
        # entirely only when they have no remaining memberships.
        memberships = RestaurantMembership.objects.filter(
            restaurant=restaurant,
        ).exclude(user__role=UserRole.ADMIN)
        user_ids = list(memberships.values_list('user_id', flat=True))
        memberships.delete()
        removed = 0
        for user in User.objects.filter(pk__in=user_ids).exclude(role=UserRole.ADMIN):
            if not user.memberships.exists():
                user.delete()
                removed += 1

        admins_kept = RestaurantMembership.objects.filter(
            restaurant=restaurant, user__role=UserRole.ADMIN
        ).count()
        return Response({
            'detail': f'Database wiped for {restaurant.slug}. Admin memberships kept.',
            'removed_users': removed,
            'admins_kept': admins_kept,
            'restaurant': restaurant.slug,
        })
