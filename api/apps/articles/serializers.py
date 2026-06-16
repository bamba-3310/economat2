from rest_framework import serializers
from .models import Article

class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = ['id', 'name', 'category', 'unit', 'sale_price', 'stock_quantity', 'min_threshold', 'shelf_life_days', 'created_at']

    def create(self, validated_data):
        return Article.objects.create(**validated_data)