from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Batch
from .serializers import BatchSerializer
from apps.permissions import IsAdminOrEconome

class BatchListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsAdminOrEconome()]
        return [IsAuthenticated()]

    def get(self, request):
        """List all batches (all connected)"""
        batches = Batch.objects.all().order_by('received_at')
        return Response(BatchSerializer(batches, many=True).data)

    def post(self, request):
        """Create a batches (Admin/Econome)"""
        serializer = BatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        article = serializer.validated_data['article']

        # Calculates expiry_date automatically if the article has a conservation duration
        extra = {}
        if article.shelf_life_days and 'expiry_date' not in request.data:
            extra['expiry_date'] = timezone.now().date() + timedelta(days=article.shelf_life_days)

        batch = serializer.save()
        return Response(BatchSerializer(batch).data, status=status.HTTP_201_CREATED)


class BatchDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrEconome]

    def patch(self, request, pk):
        """Update a batches (Admin/Econome)"""
        try:
            batch = Batch.objects.get(pk=pk)
        except Batch.DoesNotExist:
            return Response({'detail': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = BatchSerializer(batch, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        batch = serializer.save()
        return Response(BatchSerializer(batch).data)

    def delete(self, request, pk):
        """Delete a batches (Admin/Econome)"""
        try:
            batch = Batch.objects.get(pk=pk)
        except Batch.DoesNotExist:
            return Response({'detail': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)
        batch.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)