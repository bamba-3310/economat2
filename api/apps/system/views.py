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

from .models import Branding
from .serializers import BrandingSerializer


# GET is public so the login screen (pre-auth) can show the restaurant name.
# PATCH is admin-only (set a custom name, or restore the default).
class BrandingView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated(), IsAdmin()]

    def get(self, request):
        return Response(BrandingSerializer(Branding.get_solo()).data)

    def patch(self, request):
        branding = Branding.get_solo()
        # restore=true clears the override -> effective_name falls back to the
        # default in settings.DEFAULT_RESTAURANT_NAME.
        if request.data.get('restore'):
            branding.restaurant_name = ''
        else:
            name = request.data.get('name')
            if name is None:
                return Response({'detail': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)
            branding.restaurant_name = str(name).strip()[:120]
        branding.save()
        return Response(BrandingSerializer(branding).data)


# WHY: a "start fresh" action for reuse / handover. Deletes all operational data
# and every non-admin account, but keeps admin accounts (so nobody is locked
# out) and the branding row. Admin-only and run in a single transaction.
class WipeDatabaseView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @transaction.atomic
    def post(self, request):
        Movement.objects.all().delete()
        Alert.objects.all().delete()
        Delivery.objects.all().delete()
        Batch.objects.all().delete()
        Article.objects.all().delete()
        Supplier.objects.all().delete()
        Category.objects.all().delete()
        removed, _ = User.objects.exclude(role=UserRole.ADMIN).delete()
        admins_kept = User.objects.filter(role=UserRole.ADMIN).count()
        return Response({
            'detail': 'Database wiped. Admin accounts kept.',
            'removed_users': removed,
            'admins_kept': admins_kept,
        })
