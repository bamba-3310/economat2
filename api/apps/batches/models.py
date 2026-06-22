from django.db import models


# WHY: the frontend treats a batch (lot) as having a human code (LC-...), a
# reserve/in-service lifecycle (the scan "activation" toggle) and an initial
# quantity (to compute "running low"). The model only stored current quantity.
# WHEN: added during the PostgreSQL/Django wiring. The richer "running low /
# depleted / expired" statuses are DERIVED by the adapter; only the stored
# lifecycle state (reserve / in_service) lives here. Defaults migrate cleanly.
class BatchStatus(models.TextChoices):
    RESERVE = 'reserve', 'In reserve'
    IN_SERVICE = 'in_service', 'In service'


class Batch(models.Model):
    quantity = models.PositiveIntegerField(default=0)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    expiry_date = models.DateField(null=True, blank=True)
    qr_code_path = models.TextField(null=True, blank=True)
    received_at = models.DateField(auto_now_add=True)

    # --- New lot fields (see WHY/WHEN above) ---
    code = models.CharField(max_length=40, null=True, blank=True)
    initial_quantity = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=BatchStatus.choices, default=BatchStatus.RESERVE)

    article = models.ForeignKey('articles.Article', on_delete=models.PROTECT, related_name='batches')
    supplier = models.ForeignKey('suppliers.Supplier', on_delete=models.SET_NULL, null=True, blank=True, related_name='batches')

    class Meta:
        db_table = 'batches'