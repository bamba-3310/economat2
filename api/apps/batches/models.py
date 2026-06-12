from django.db import models

class Batch(models.Model):
    quantity = models.PositiveIntegerField(default=0)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    expiry_date = models.DateField(null=True, blank=True)
    qr_code_path = models.TextField(null=True, blank=True)
    received_at = models.DateField(auto_now_add=True)

    article = models.ForeignKey('articles.Article', on_delete=models.PROTECT, related_name='batches')
    supplier = models.ForeignKey('suppliers.Supplier', on_delete=models.SET_NULL, null=True, blank=True, related_name='batches')

    class Meta:
        db_table = 'batches'