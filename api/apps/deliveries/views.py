from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.permissions import HasAnyAppPermission
from apps.articles.models import Article
from apps.categories.models import Category
from apps.suppliers.models import Supplier
from apps.batches.models import Batch, BatchStatus
from apps.movements.models import Movement, MovementType
from apps.alerts.utils import check_stock_threshold
from apps.restaurants.tenancy import assert_restaurant_member, for_restaurant
from .models import Delivery, DeliveryStatus
from .serializers import DeliverySerializer


def _parse_expiry(raw_expiry):
    """Tolerant date parsing: date object, date string, or datetime string."""
    if isinstance(raw_expiry, date):
        return raw_expiry
    if raw_expiry:
        return parse_date(str(raw_expiry)[:10])
    return None


class DeliveryListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasAnyAppPermission('validate_deliveries')]
        return [IsAuthenticated()]

    def get(self, request):
        assert_restaurant_member(request)
        deliveries = for_restaurant(Delivery.objects.all(), request).order_by('-created_at')
        return Response(DeliverySerializer(deliveries, many=True).data)

    @transaction.atomic
    def post(self, request):
        restaurant = assert_restaurant_member(request)
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
            supplier = Supplier.objects.filter(pk=supplier_id, restaurant=restaurant).first()

        resolved_lines = []
        for index, line in enumerate(lines, start=1):
            try:
                quantity = int(line.get('quantity'))
            except (TypeError, ValueError):
                return Response(
                    {'detail': f'line {index}: quantity must be a whole number'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if quantity <= 0:
                return Response(
                    {'detail': f'line {index}: quantity must be greater than zero'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            article = None
            category = None
            if line.get('article'):
                article = Article.objects.filter(pk=line['article'], restaurant=restaurant).first()
                if article is None:
                    return Response(
                        {'detail': f'line {index}: unknown article'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            elif line.get('product_name'):
                category = Category.objects.filter(pk=line.get('category'), restaurant=restaurant).first()
                if category is None:
                    return Response(
                        {'detail': 'a valid category is required to create a new article'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                return Response(
                    {'detail': 'each line needs an article or a product_name'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                threshold = int(line.get('threshold') or 0)
            except (TypeError, ValueError):
                threshold = 0

            resolved_lines.append({
                'article': article,
                'category': category,
                'quantity': quantity,
                'threshold': max(0, threshold),
                'line': line,
            })

        snapshot = []
        for entry in resolved_lines:
            line = entry['line']
            quantity = entry['quantity']
            article = entry['article']

            if article is None:
                article, _ = Article.objects.get_or_create(
                    restaurant=restaurant,
                    name=line['product_name'],
                    defaults={
                        'category': entry['category'],
                        'unit': line.get('unit') or 'unite',
                        'min_threshold': entry['threshold'],
                    },
                )

            expiry = _parse_expiry(line.get('expiry_date'))
            if not expiry and article.shelf_life_days:
                expiry = timezone.now().date() + timedelta(days=article.shelf_life_days)

            # Auto-activate: lots are created already in service (no manual step).
            batch = Batch.objects.create(
                restaurant=restaurant,
                article=article,
                supplier=supplier,
                quantity=quantity,
                initial_quantity=quantity,
                code=line.get('lot_code') or None,
                expiry_date=expiry,
                status=BatchStatus.IN_SERVICE,
            )

            Movement.objects.create(
                restaurant=restaurant,
                article=article, batch=batch,
                user=request.user, user_name=request.user.name,
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
            restaurant=restaurant,
            reference=reference,
            delivered_at=_parse_expiry(data.get('delivered_at')),
            status=DeliveryStatus.VALIDATED,
            validated_by=request.user,
            supplier=supplier,
            lines=snapshot,
        )
        return Response(DeliverySerializer(delivery).data, status=status.HTTP_201_CREATED)
