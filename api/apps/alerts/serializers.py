from rest_framework import serializers
from .models import Alert

class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ['id', 'article', 'type', 'message', 'read', 'created_at']
        read_only_fields = ['article', 'type', 'message', 'created_at']