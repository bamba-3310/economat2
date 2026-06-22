from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.permissions import IsAdminOrEconome
from apps.articles.models import Article
from apps.categories.models import Category
from apps.suppliers.models import Supplier
from apps.batches.models import Batch, BatchStatus
from apps.movements.models import Movement, MovementType
from apps.alerts.utils import check_stock_threshold
from .models import Delivery, DeliveryStatus
from .serializers import DeliverySerializer


# WHY: validating a delivery must atomically create one batch + one entry
# movement per line (and the article if it is new), bump the article stock, and
# persist the delivery header. Putting this server-side keeps it in a single DB
# transaction. WHEN: added during the PostgreSQL/Django wiring.
class DeliveryListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsAdminOrEconome()]
        return [IsAuthenticated()]

    def get(self, request):
        deliveries = Delivery.objects.all().order_by('-created_at')
        return Response(DeliverySerializer(deliveries, many=True).data)

    @transaction.atomic
    def post(self, request):
        data = request.data
        reference = data.get('reference')
        lines = data.get('lines') or []

        if not reference:
            return Response({'detail': 'reference is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not lines:
            return Response({'detail': 'at least one line is required'}, status=status.HTTP_400_BAD_REQUEST)

        supplier = None
        supplier_id = data.get('supplier')
        if supplier_id:
            supplier = Supplier.objects.filter(pk=supplier_id).first()

        snapshot = []
        for line in lines:
            quantity = int(line.get('quantity') or 0)

            # Resolve (or create) the article for this line.
            article = None
            if line.get('article'):
                article = Article.objects.filter(pk=line['article']).first()
            if article is None and line.get('product_name'):
                category = Category.objects.filter(pk=line.get('category')).first()
                if category is None:
                    return Response(
                        {'detail': 'a valid category is required to create a new article'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                article, _ = Article.objects.get_or_create(
                    name=line['product_name'],
                    defaults={
                        'category': category,
                        'unit': line.get('unit') or 'unite',
                        'min_threshold': int(line.get('threshold') or 0),
                    },
                )
            if article is None:
                return Response({'detail': 'each line needs an article or a product_name'},
                                status=status.HTTP_400_BAD_REQUEST)

            # Expiry: explicit value, else derived from the article shelf life.
            # Parse to a real date object — passing a raw string to create()
            # leaves the in-memory instance's expiry_date as a str, which later
            # broke `.isoformat()` (AttributeError on the snapshot below).
            raw_expiry = line.get('expiry_date')
            if isinstance(raw_expiry, date):
                expiry = raw_expiry
            elif raw_expiry:
                expiry = parse_date(str(raw_expiry)[:10])  # tolerate date or datetime strings
            else:
                expiry = None
            if not expiry and article.shelf_life_days:
                expiry = timezone.now().date() + timedelta(days=article.shelf_life_days)

            batch = Batch.objects.create(
                article=article,
                supplier=supplier,
                quantity=quantity,
                initial_quantity=quantity,
                code=line.get('lot_code') or None,
                expiry_date=expiry,
                status=BatchStatus.RESERVE,
            )

            # Entry movement + stock bump (done inline since we are already in a
            # transaction and not going through the movement view).
            Movement.objects.create(
                article=article, batch=batch, user=request.user,
                type=MovementType.ENTRY, quantity=quantity, motive=reference,
            )
            article.stock_quantity += quantity
            article.save()
            check_stock_threshold(article)

            snapshot.append({
                'article': article.id,
                'product_name': article.name,
                'batch': batch.id,
                'lot_code': batch.code,
                'quantity': quantity,
                'unit': article.unit,
                'expiry_date': expiry.isoformat() if expiry else None,
            })

        delivery = Delivery.objects.create(
            reference=reference,
            delivered_at=data.get('delivered_at') or None,
            status=DeliveryStatus.VALIDATED,
            validated_by=request.user,
            supplier=supplier,
            lines=snapshot,
        )
        return Response(DeliverySerializer(delivery).data, status=status.HTTP_201_CREATED)
