from django.db import models


# WHY: the Next.js frontend drives its stock logic (FEFO / multi-lots, low &
# critical thresholds, "expiring soon" windows) from per-category rules. The
# original model only stored `name`, so those rules lived nowhere in the DB.
# WHEN: added while wiring the frontend to PostgreSQL/Django (adapter routes).
# All new fields have defaults so the existing rows migrate cleanly.
class CategoryMode(models.TextChoices):
    STANDARD = 'standard', 'Standard'
    FEFO = 'fefo', 'FEFO strict'
    MULTI_LOTS = 'multi_lots', 'Multi-lots'


class Category(models.Model):
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='categories',
    )
    name = models.CharField(max_length=50)

    # --- New rule fields (see WHY/WHEN above) ---
    mode = models.CharField(max_length=20, choices=CategoryMode.choices, default=CategoryMode.STANDARD)
    default_threshold = models.PositiveIntegerField(default=0)
    critical_threshold = models.PositiveIntegerField(default=0)
    soon_expires_days = models.PositiveIntegerField(default=0)
    auto_expiration_days = models.PositiveIntegerField(null=True, blank=True)
    switch_threshold = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'categories'
        unique_together = (('restaurant', 'name'),)
