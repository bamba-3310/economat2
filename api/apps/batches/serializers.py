from rest_framework import serializers
from .models import Batch

class BatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Batch
        # WHEN/WHY: exposed code/initial_quantity/status added for the frontend
        # lot lifecycle. Previously the list ended at 'received_at'.
        fields = ['id', 'article', 'supplier', 'quantity', 'initial_quantity',
                  'code', 'status', 'purchase_price', 'expiry_date',
                  'qr_code_path', 'received_at']

    def create(self, validated_data):
        return Batch.objects.create(**validated_data)