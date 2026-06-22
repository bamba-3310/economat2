from rest_framework import serializers
from .models import Delivery


class DeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = Delivery
        fields = ['id', 'reference', 'delivered_at', 'status', 'lines',
                  'supplier', 'validated_by', 'created_at']
