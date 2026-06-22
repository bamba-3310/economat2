from rest_framework import serializers
from .models import Supplier

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        # WHEN/WHY: added contact/email/is_active/created_at for the frontend
        # supplier sheet. Previously: fields = ['id', 'name', 'phone'].
        fields = ['id', 'name', 'phone', 'contact', 'email', 'is_active', 'created_at']

    def create(self, validated_data):
        return Supplier.objects.create(**validated_data)