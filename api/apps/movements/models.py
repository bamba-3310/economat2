from django.db import models

class MovementType(models.TextChoices):
    ENTRY = 'entry', 'Entry'
    KITCHEN_EXIT = 'kitchen_exit', 'Kitchen_Exit'
    LOSS = 'loss', 'Loss'
    DELETION = 'deletion', 'Deletion'
    # WHEN/WHY: the frontend records two more movement kinds — activating a lot
    # (reserve -> in service) and stock corrections. Added during the
    # PostgreSQL/Django wiring; existing rows are unaffected.
    ACTIVATION = 'activation', 'Activation'
    CORRECTION = 'correction', 'Correction'


class Movement(models.Model):
    type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity = models.PositiveIntegerField()
    motive = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    article = models.ForeignKey('articles.Article', on_delete=models.PROTECT, related_name='movements')
    # WHEN/WHY: SET_NULL (was PROTECT) so an expired/empty lot (batch) can be
    # deleted while keeping its movement history (the movement keeps the article
    # reference; only the batch link is cleared). Added with the lot-delete feature.
    batch = models.ForeignKey('batches.Batch', on_delete=models.SET_NULL, null=True, blank=True, related_name='movements')
    user = models.ForeignKey('accounts.User', on_delete=models.PROTECT, related_name='movements')

    class Meta:
        db_table = 'movements'