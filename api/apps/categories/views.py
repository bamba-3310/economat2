from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Category
from .serializers import CategorySerializer
from apps.permissions import IsAdminOrEconome


class CategoryListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsAdminOrEconome()]
        return [IsAuthenticated()]

    def get(self, request):
        """List all categories (all connected)"""
        categories = Category.objects.all().order_by('name')
        return Response(CategorySerializer(categories, many=True).data)

    def post(self, request):
        """Create a category (Admin & Econome)"""
        serializer = CategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        return Response(CategorySerializer(category).data, status=status.HTTP_201_CREATED)


class CategoryDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrEconome]

    def patch(self, request, pk):
        """Update a category (Admin & Econome)"""
        try:
            category = Category.objects.get(pk=pk)
        except Category.DoesNotExist:
            return Response({'detail': 'Category does not exist'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CategorySerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CategorySerializer(category).data)

    def delete(self, request, pk):
        """Delete a category (Admin & Econome only)"""
        try:
            category = Category.objects.get(pk=pk)
        except Category.DoesNotExist:
            return Response({'detail': 'Category does not exist'}, status=status.HTTP_404_NOT_FOUND)
        category.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)