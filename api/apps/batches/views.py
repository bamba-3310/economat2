from datetime import timedelta

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Batch
from .serializers import BatchSerializer
from apps.permissions import HasAnyAppPermission
from apps.restaurants.tenancy import assert_restaurant_member, for_restaurant, get_tenant_object_or_404


class BatchListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasAnyAppPermission('validate_deliveries', 'edit_lots')]
        return [IsAuthenticated()]

    def get(self, request):
        assert_restaurant_member(request)
        batches = for_restaurant(Batch.objects.all(), request).order_by('received_at')
        return Response(BatchSerializer(batches, many=True).data)

    def post(self, request):
        restaurant = assert_restaurant_member(request)
        serializer = BatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        article = serializer.validated_data['article']
        if article.restaurant_id != restaurant.id:
            return Response({'detail': 'Article not in this restaurant'}, status=status.HTTP_400_BAD_REQUEST)

        extra = {'restaurant': restaurant}
        if article.shelf_life_days and not serializer.validated_data.get('expiry_date'):
            extra['expiry_date'] = timezone.now().date() + timedelta(days=article.shelf_life_days)

        batch = serializer.save(**extra)
        return Response(BatchSerializer(batch).data, status=status.HTTP_201_CREATED)


class BatchDetailView(APIView):
    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), HasAnyAppPermission('edit_lots')]
        return [
            IsAuthenticated(),
            HasAnyAppPermission('edit_lots', 'edit_stock', 'edit_expiration_dates'),
        ]

    def patch(self, request, pk):
        assert_restaurant_member(request)
        batch = get_tenant_object_or_404(Batch, request, pk=pk)
        serializer = BatchSerializer(batch, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        batch = serializer.save()
        return Response(BatchSerializer(batch).data)

    def delete(self, request, pk):
        assert_restaurant_member(request)
        batch = get_tenant_object_or_404(Batch, request, pk=pk)
        batch.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
