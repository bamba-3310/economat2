from django.db import models

class MovementType(models.TextChoices):
    ENTRY = 'entry', 'Entry'
    KITCHEN_EXIT = 'kitchen_exit', 'Kitchen_Exit'
    LOSS = 'loss', 'Loss'
    DELETION = 'deletion', 'Deletion'


class Movement(models.Model):
    type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity = models.PositiveIntegerField()
    motive = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    article = models.ForeignKey('articles.Article', on_delete=models.PROTECT, related_name='movements')
    batch = models.ForeignKey('batches.Batch', on_delete=models.PROTECT, null=True, blank=True, related_name='movements')
    user = models.ForeignKey('accounts.User', on_delete=models.PROTECT, related_name='movements')

    class Meta:
        db_table = 'movements'