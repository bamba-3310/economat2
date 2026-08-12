from django.db.models import ProtectedError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Category
from .serializers import CategorySerializer
from apps.permissions import HasAnyAppPermission
from apps.restaurants.tenancy import assert_restaurant_member, for_restaurant, get_tenant_object_or_404


class CategoryListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasAnyAppPermission('manage_categories', 'edit_thresholds')]
        return [IsAuthenticated()]

    def get(self, request):
        assert_restaurant_member(request)
        categories = for_restaurant(Category.objects.all(), request).order_by('name')
        return Response(CategorySerializer(categories, many=True).data)

    def post(self, request):
        restaurant = assert_restaurant_member(request)
        serializer = CategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save(restaurant=restaurant)
        return Response(CategorySerializer(category).data, status=status.HTTP_201_CREATED)


class CategoryDetailView(APIView):
    def get_permissions(self):
        return [IsAuthenticated(), HasAnyAppPermission('manage_categories', 'edit_thresholds')]

    def patch(self, request, pk):
        assert_restaurant_member(request)
        category = get_tenant_object_or_404(Category, request, pk=pk)
        serializer = CategorySerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CategorySerializer(category).data)

    def delete(self, request, pk):
        assert_restaurant_member(request)
        category = get_tenant_object_or_404(Category, request, pk=pk)
        try:
            category.delete()
        except ProtectedError:
            return Response(
                {'detail': 'Category still has linked products'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
