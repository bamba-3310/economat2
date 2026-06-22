from django.conf import settings as django_settings
from rest_framework import serializers


class BrandingSerializer(serializers.Serializer):
    # `name` is what the UI should display (custom value, or the default).
    name = serializers.SerializerMethodField()
    # `default_name` lets the UI offer a "restore to default" affordance and
    # show what the default is.
    default_name = serializers.SerializerMethodField()
    # `is_custom` is True when an admin has overridden the default.
    is_custom = serializers.SerializerMethodField()

    def get_name(self, obj):
        return obj.effective_name

    def get_default_name(self, obj):
        return django_settings.DEFAULT_RESTAURANT_NAME

    def get_is_custom(self, obj):
        return bool(obj.restaurant_name)
