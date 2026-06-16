from rest_framework import serializers
from .models import Movement

class MovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Movement
        fields = ['id', 'article', 'batch', 'user', 'type', 'quantity', 'motive', 'created_at']
        read_only_fields = ['user', 'created_at']

    def create(self, validated_data):
        return Movement.objects.create(**validated_data)