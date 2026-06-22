from django.conf import settings as django_settings
from django.db import models


# WHY: the restaurant name was hard-coded ("Le Carré") all over the UI, so the
# software could not be reused for another restaurant. This single-row table
# holds the configurable name; an empty value means "use the default", so the
# default lives in ONE place (settings.DEFAULT_RESTAURANT_NAME) and "restore to
# default" simply clears the field. WHEN: added with the branding feature.
class Branding(models.Model):
    restaurant_name = models.CharField(max_length=120, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'branding'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def effective_name(self):
        return self.restaurant_name or django_settings.DEFAULT_RESTAURANT_NAME
