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
    # WHEN/WHY: the web frontend hardcoded its 15-minute idle logout while the
    # backend reads SESSION_IDLE_MINUTES from env — changing the env silently
    # desynchronized the two. The public branding/config endpoint now carries
    # the authoritative value so the client mirrors it.
    session_idle_minutes = serializers.SerializerMethodField()

    def get_name(self, obj):
        return obj.effective_name

    def get_default_name(self, obj):
        return django_settings.DEFAULT_RESTAURANT_NAME

    def get_is_custom(self, obj):
        return bool(obj.restaurant_name)

    def get_session_idle_minutes(self, obj):
        return int(django_settings.SESSION_IDLE_TIMEOUT.total_seconds() // 60)
