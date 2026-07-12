from django.db.models import ProtectedError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Category
from .serializers import CategorySerializer
from apps.permissions import HasAnyAppPermission


# WHEN/WHY: write access was role-based (IsAdminOrEconome); it now mirrors the
# granular rights the frontend checks for category management (the Next.js
# /api/categories route requires manage_categories or edit_thresholds).
class CategoryListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasAnyAppPermission('manage_categories', 'edit_thresholds')]
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
    def get_permissions(self):
        return [IsAuthenticated(), HasAnyAppPermission('manage_categories', 'edit_thresholds')]

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
        # Article.category is PROTECT: a category with products cannot be deleted.
        # Return a clean 400 instead of letting ProtectedError surface as a 500.
        try:
            category.delete()
        except ProtectedError:
            return Response(
                {'detail': 'Category still has linked products'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)