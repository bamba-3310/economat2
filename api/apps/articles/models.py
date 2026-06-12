from django.db import models

class Article(models.Model):
    name = models.CharField(max_length=100, unique=True)
    unit = models.CharField(max_length=20)
    sale_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_quantity = models.IntegerField(default=0)
    min_threshold = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    category = models.ForeignKey('categories.Category', on_delete=models.PROTECT, related_name='articles')

    class Meta:
        db_table = 'articles'