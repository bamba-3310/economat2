from django.db import models

class Supplier(models.Model):
    name = models.CharField(max_length=100, unique=True)
    phone = models.CharField(max_length=20, null=True, blank=True)

    # WHY: the frontend supplier sheet shows a contact person, an email and an
    # active/inactive toggle, and orders suppliers by creation date. The model
    # only had name+phone. WHEN: added during the PostgreSQL/Django wiring.
    # Defaults keep existing rows valid.
    contact = models.CharField(max_length=100, null=True, blank=True)
    email = models.EmailField(max_length=150, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        db_table = 'suppliers'