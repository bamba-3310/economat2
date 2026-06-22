from rest_framework import serializers
from .models import Category

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        # WHEN/WHY: exposed the new rule fields (mode, thresholds, expiry windows)
        # added for the frontend stock logic. Previously: fields = ['id', 'name'].
        fields = [
            'id', 'name', 'mode',
            'default_threshold', 'critical_threshold', 'soon_expires_days',
            'auto_expiration_days', 'switch_threshold',
        ]

    def create(self, validated_data):
        return Category.objects.create(**validated_data)

