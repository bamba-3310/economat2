from .models import Alert
from django.utils import timezone
from datetime import timedelta


def check_stock_threshold(article):
    """Creates an alert if the stock is under the minimum threshold"""
    if article.stock_quantity <= article.min_threshold:
        # Prevent duplicates - doesn't create if an unread alert already exists
        already_exists = Alert.objects.filter(
            article=article,
            type='threshold',
            read=False
        ).exists()

        if not already_exists:
            Alert.objects.create(
                article=article,
                type='threshold',
                message=f"Low stock : {article.name} ({article.stock_quantity} {article.unit} left, threshold : {article.min_threshold}"
            )


def check_expiration_dates():
    """Creates alerts for the products that will expire in less than 2 days"""
    from apps.batches.models import Batch

    bathes = Batch.objects.filter(
        expiry_date__gte=timezone.now().date(),
    ).select_related('article')

    for batch in bathes:
        # Window = 50% of the conservation duration, minimum 1 day
        shelf_life = batch.article.shelf_life_days or 7
        warning_days = max(1, shelf_life // 2)

        limit = timezone.now().date() + timedelta(days=warning_days)

        if batch.expiry_date > limit:
            continue    # not in the alert zone yet

        already_exists = Alert.objects.filter(
            article=article,
            type='expiration',
            read=False
        ).exists()

        if not already_exists:
            days_left = (batch.expiry_date - timezone.now().date()).days
            Alert.objects.create(
                article=article,
                message=f"Expiry in {days_left} day(s) : {batch.article.name} - batch {batch.received_at.date()} ({batch.quantity} {batch.article.unit}"
            )


def clean_old_alerts():
    """Deletes old alerts after more than 30 days"""
    limit = timezone.now() - timedelta(days=30)
    Alert.objects.filter(read=True, created_at__lt=limit).delete()