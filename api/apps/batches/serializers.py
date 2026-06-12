from rest_framework import serializers
from .models import Batch

class BatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Batch
        fields = ['id', 'article', 'supplier', 'quantity', 'purchase_price', 'expiry_date', 'qr_code_path', 'received_at']

    def create(self, validated_data):
        return Batch.objects.create(**validated_data)