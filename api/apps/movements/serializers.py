from rest_framework import serializers
from .models import Movement

class MovementSerializer(serializers.ModelSerializer):
    # WHEN/WHY: PositiveIntegerField allows 0, which let no-op movements into
    # the audit trail; a movement must move at least one unit.
    quantity = serializers.IntegerField(min_value=1)

    class Meta:
        model = Movement
        # user_name: author-name snapshot taken server-side at creation; it
        # outlives account deletion (Movement.user goes null, the name stays).
        fields = ['id', 'article', 'batch', 'user', 'user_name', 'type', 'quantity', 'motive', 'created_at']
        read_only_fields = ['user', 'user_name', 'created_at']

    # WHEN/WHY: nothing checked that the referenced batch belonged to the
    # referenced article, so a mismatched pair silently corrupted the history
    # (and, now that the view updates the batch, the wrong lot's stock).
    def validate(self, attrs):
        batch = attrs.get('batch')
        article = attrs.get('article')
        if batch is not None and article is not None and batch.article_id != article.id:
            raise serializers.ValidationError(
                {'batch': 'Batch does not belong to the given article'}
            )
        return attrs

    def create(self, validated_data):
        return Movement.objects.create(**validated_data)
