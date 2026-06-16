from django.db import models

class AlertType(models.TextChoices):
    THRESHOLD = 'threshold', 'Threshold'
    EXPIRATION = 'expiration', 'Expiration'


class Alert(models.Model):
    type = models.CharField(max_length=20, choices=AlertType.choices)
    message = models.CharField(max_length=255)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    article = models.ForeignKey('articles.Article', on_delete=models.CASCADE, related_name='alerts', null=True, blank=True)

    class Meta:
        db_table = 'alerts'