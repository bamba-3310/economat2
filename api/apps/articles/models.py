from django.db import models

class Article(models.Model):
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='articles',
    )
    name = models.CharField(max_length=100)
    unit = models.CharField(max_length=20)
    sale_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_quantity = models.PositiveIntegerField(default=0)
    min_threshold = models.PositiveIntegerField(default=0)
    shelf_life_days = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    category = models.ForeignKey('categories.Category', on_delete=models.PROTECT, related_name='articles')

    class Meta:
        db_table = 'articles'
        unique_together = (('restaurant', 'name'),)