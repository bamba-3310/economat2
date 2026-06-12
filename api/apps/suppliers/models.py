from django.db import models

class Supplier(models.Model):
    name = models.CharField(max_length=100, unique=True)
    phone = models.CharField(max_length=20, null=True, blank=True)

    class Meta:
        db_table = 'suppliers'