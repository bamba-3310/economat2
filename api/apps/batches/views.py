from datetime import timedelta

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Batch
from .serializers import BatchSerializer
from apps.permissions import HasAnyAppPermission

class BatchListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasAnyAppPermission('validate_deliveries', 'edit_lots')]
        return [IsAuthenticated()]

    def get(self, request):
        """List all batches (all connected)"""
        batches = Batch.objects.all().order_by('received_at')
        return Response(BatchSerializer(batches, many=True).data)

    def post(self, request):
        """Create a batch (admin, or validate_deliveries/edit_lots holder)"""
        serializer = BatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        article = serializer.validated_data['article']

        # Calculates expiry_date automatically if the article has a conservation
        # duration and the caller didn't provide one.
        # WHEN/WHY: this block previously crashed with a NameError
        # (timezone/timedelta were never imported) and, once computed, `extra`
        # was silently discarded — serializer.save() was called without it, so
        # the auto-expiry feature never worked on this path. Both fixed.
        extra = {}
        if article.shelf_life_days and not serializer.validated_data.get('expiry_date'):
            extra['expiry_date'] = timezone.now().date() + timedelta(days=article.shelf_life_days)

        batch = serializer.save(**extra)
        return Response(BatchSerializer(batch).data, status=status.HTTP_201_CREATED)


class BatchDetailView(APIView):
    # WHEN/WHY: was IsAdminOrEconome, which 403'd cooks holding granular stock
    # rights (the frontend checks edit_lots/edit_stock/edit_expiration_dates for
    # these operations). Now mirrors the frontend's permission model.
    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), HasAnyAppPermission('edit_lots')]
        return [
            IsAuthenticated(),
            HasAnyAppPermission('edit_lots', 'edit_stock', 'edit_expiration_dates'),
        ]

    def patch(self, request, pk):
        """Update a batch"""
        try:
            batch = Batch.objects.get(pk=pk)
        except Batch.DoesNotExist:
            return Response({'detail': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = BatchSerializer(batch, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        batch = serializer.save()
        return Response(BatchSerializer(batch).data)

    def delete(self, request, pk):
        """Delete a batch"""
        try:
            batch = Batch.objects.get(pk=pk)
        except Batch.DoesNotExist:
            return Response({'detail': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        batch.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
