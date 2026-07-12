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
                message=f"Low stock : {article.name} ({article.stock_quantity} {article.unit} left, threshold : {article.min_threshold})"
            )


def check_expiration_dates():
    """Creates alerts for batches inside their expiry warning window (incl. already expired)."""
    from apps.batches.models import Batch

    # WHEN/WHY: rewritten after a code review found this function crashed with a
    # NameError (`article` was undefined — it must be `batch.article`), created
    # alerts without `type='expiration'` (so the dedupe filter below never
    # matched and duplicates piled up), and called `.date()` on `received_at`,
    # which is already a date. The old `expiry_date__gte=today` filter also
    # silently skipped batches that had ALREADY expired; those are the most
    # urgent ones, so expired batches with stock left now alert too.
    today = timezone.now().date()
    batches = Batch.objects.filter(
        expiry_date__isnull=False,
        quantity__gt=0,
    ).select_related('article')

    for batch in batches:
        # Window = 50% of the conservation duration, minimum 1 day
        shelf_life = batch.article.shelf_life_days or 7
        warning_days = max(1, shelf_life // 2)

        limit = today + timedelta(days=warning_days)

        if batch.expiry_date > limit:
            continue    # not in the alert zone yet

        already_exists = Alert.objects.filter(
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
                article=batch.article,
                type='expiration',
                message=message,
            )


def clean_old_alerts():
    """Deletes old alerts after more than 30 days"""
    limit = timezone.now() - timedelta(days=30)
    Alert.objects.filter(read=True, created_at__lt=limit).delete()
