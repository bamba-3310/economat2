from .models import Alert
from django.utils import timezone
from datetime import timedelta


def check_stock_threshold(article):
    """Creates an alert if the stock is under the minimum threshold"""
    if article.stock_quantity <= article.min_threshold:
        already_exists = Alert.objects.filter(
            restaurant_id=article.restaurant_id,
            article=article,
            type='threshold',
            read=False
        ).exists()

        if not already_exists:
            Alert.objects.create(
                restaurant_id=article.restaurant_id,
                article=article,
                type='threshold',
                message=f"Low stock : {article.name} ({article.stock_quantity} {article.unit} left, threshold : {article.min_threshold})"
            )


def check_expiration_dates(restaurant=None):
    """Creates alerts for batches inside their expiry warning window (incl. already expired)."""
    from apps.batches.models import Batch

    today = timezone.now().date()
    batches = Batch.objects.filter(
        expiry_date__isnull=False,
        quantity__gt=0,
    ).select_related('article')
    if restaurant is not None:
        batches = batches.filter(restaurant=restaurant)

    for batch in batches:
        shelf_life = batch.article.shelf_life_days or 7
        warning_days = max(1, shelf_life // 2)

        limit = today + timedelta(days=warning_days)

        if batch.expiry_date > limit:
            continue

        already_exists = Alert.objects.filter(
            restaurant_id=batch.restaurant_id,
            article=batch.article,
            type='expiration',
            read=False
        ).exists()

        if not already_exists:
            days_left = (batch.expiry_date - today).days
            detail = f"{batch.article.name} - batch {batch.received_at} ({batch.quantity} {batch.article.unit})"
            message = (
                f"Expired {-days_left} day(s) ago : {detail}"
                if days_left < 0
                else f"Expiry in {days_left} day(s) : {detail}"
            )
            Alert.objects.create(
                restaurant_id=batch.restaurant_id,
                article=batch.article,
                type='expiration',
                message=message,
            )


def clean_old_alerts(restaurant=None):
    """Deletes old alerts after more than 30 days"""
    limit = timezone.now() - timedelta(days=30)
    qs = Alert.objects.filter(read=True, created_at__lt=limit)
    if restaurant is not None:
        qs = qs.filter(restaurant=restaurant)
    qs.delete()
