from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Supplier
from .serializers import SupplierSerializer
from apps.permissions import HasAnyAppPermission
from apps.restaurants.tenancy import assert_restaurant_member, for_restaurant, get_tenant_object_or_404


class SupplierListCreateView(APIView):
    def get_permissions(self):
        if self.request.method in ('POST', 'GET'):
            return [IsAuthenticated(), HasAnyAppPermission('validate_deliveries')]
        return [IsAuthenticated()]

    def get(self, request):
        assert_restaurant_member(request)
        suppliers = for_restaurant(Supplier.objects.all(), request).order_by('name')
        return Response(SupplierSerializer(suppliers, many=True).data)

    def post(self, request):
        restaurant = assert_restaurant_member(request)
        serializer = SupplierSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        supplier = serializer.save(restaurant=restaurant)
        return Response(SupplierSerializer(supplier).data, status=status.HTTP_201_CREATED)


class SupplierDetailView(APIView):
    def get_permissions(self):
        return [IsAuthenticated(), HasAnyAppPermission('validate_deliveries')]

    def patch(self, request, pk):
        assert_restaurant_member(request)
        supplier = get_tenant_object_or_404(Supplier, request, pk=pk)
        serializer = SupplierSerializer(supplier, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SupplierSerializer(supplier).data)

    def delete(self, request, pk):
        assert_restaurant_member(request)
        supplier = get_tenant_object_or_404(Supplier, request, pk=pk)
        supplier.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
