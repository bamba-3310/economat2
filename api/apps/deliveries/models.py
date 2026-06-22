from django.db import models


# WHY: the frontend has a "delivery / receiving" workflow (Livraison) that the
# backend had no concept of — validating a delivery is what creates the lots
# (batches) and the entry movements. WHEN: added during the PostgreSQL/Django
# wiring. The validated line snapshot is kept as JSON for history/printing.
class DeliveryStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    VALIDATED = 'validated', 'Validated'
    CANCELLED = 'cancelled', 'Cancelled'


class Delivery(models.Model):
    reference = models.CharField(max_length=60)
    delivered_at = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=DeliveryStatus.choices, default=DeliveryStatus.VALIDATED)
    lines = models.JSONField(default=list, blank=True)

    supplier = models.ForeignKey('suppliers.Supplier', on_delete=models.SET_NULL, null=True, blank=True, related_name='deliveries')
    validated_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='deliveries')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'deliveries'
