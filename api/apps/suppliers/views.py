from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Supplier
from .serializers import SupplierSerializer
from apps.permissions import HasAnyAppPermission

# WHEN/WHY: access was role-based (IsAdminOrEconome); it now mirrors the
# granular right the frontend checks for supplier management (the Next.js
# /api/suppliers route requires validate_deliveries).
class SupplierListCreateView(APIView):
    def get_permissions(self):
        if self.request.method in ('POST', 'GET'):
            return [IsAuthenticated(), HasAnyAppPermission('validate_deliveries')]
        return [IsAuthenticated()]

    def get(self, request):
        """List all suppliers (admin or validate_deliveries holder)"""
        suppliers = Supplier.objects.all().order_by('name')
        return Response(SupplierSerializer(suppliers, many=True).data)

    def post(self, request):
        """Create a supplier (Admin/Econome)"""
        serializer = SupplierSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        supplier = serializer.save()
        return Response(SupplierSerializer(supplier).data, status=status.HTTP_201_CREATED)


class SupplierDetailView(APIView):
    def get_permissions(self):
        return [IsAuthenticated(), HasAnyAppPermission('validate_deliveries')]

    def patch(self, request, pk):
        """Update a supplier (Admin/Econome)"""
        try:
            supplier = Supplier.objects.get(pk=pk)
        except Supplier.DoesNotExist:
            return Response({'message': 'Supplier does not exist'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SupplierSerializer(supplier, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SupplierSerializer(supplier).data)

    def delete(self, request, pk):
        """Delete a supplier (Admin/Econome)"""
        try:
            supplier = Supplier.objects.get(pk=pk)
        except Supplier.DoesNotExist:
            return Response({'message': 'Supplier does not exist'}, status=status.HTTP_404_NOT_FOUND)
        supplier.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)