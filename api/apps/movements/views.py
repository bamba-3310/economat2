from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from apps.alerts.utils import check_stock_threshold
from .models import Movement
from .serializers import MovementSerializer
from apps.permissions import user_has_any_permission
from apps.articles.models import Article
from apps.batches.models import Batch, BatchStatus
from apps.restaurants.tenancy import assert_restaurant_member, for_restaurant, get_tenant_object_or_404

REQUIRED_PERMISSIONS_BY_TYPE = {
    'entry': ('validate_deliveries', 'edit_stock'),
    'kitchen_exit': ('edit_stock',),
    'loss': ('edit_stock',),
    'deletion': ('edit_stock', 'edit_lots'),
    'activation': ('activate_lot', 'edit_lots'),
    'correction': ('edit_stock', 'edit_thresholds'),
}


class MovementListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        assert_restaurant_member(request)
        movements = for_restaurant(Movement.objects.all(), request).order_by('-created_at')

        article_id = request.query_params.get('article')
        if article_id:
            movements = movements.filter(article_id=article_id)

        return Response(MovementSerializer(movements, many=True).data)

    @transaction.atomic
    def post(self, request):
        restaurant = assert_restaurant_member(request)
        serializer = MovementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        quantity = serializer.validated_data['quantity']
        movement_type = serializer.validated_data['type']

        required = REQUIRED_PERMISSIONS_BY_TYPE.get(movement_type, ())
        if not user_has_any_permission(request.user, required):
            return Response(
                {'detail': 'Missing permission for this movement type'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            article = Article.objects.select_for_update().get(
                pk=serializer.validated_data['article'].id,
                restaurant=restaurant,
            )
        except Article.DoesNotExist:
            return Response({'detail': 'Article not found'}, status=status.HTTP_404_NOT_FOUND)

        batch = None
        if serializer.validated_data.get('batch') is not None:
            try:
                batch = Batch.objects.select_for_update().get(
                    pk=serializer.validated_data['batch'].id,
                    restaurant=restaurant,
                )
            except Batch.DoesNotExist:
                return Response({'detail': 'Batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if movement_type == 'entry':
            article.stock_quantity += quantity
            article.save()
            if batch is not None:
                batch.quantity += quantity
                batch.save()
        elif movement_type in ('kitchen_exit', 'loss', 'deletion'):
            # Legacy reserve lots: auto-activate on first kitchen exit.
            if (
                movement_type == 'kitchen_exit'
                and batch is not None
                and batch.status == BatchStatus.RESERVE
            ):
                batch.status = BatchStatus.IN_SERVICE
                batch.save(update_fields=['status'])
            if article.stock_quantity < quantity:
                return Response(
                    {'detail': f'Move not enough stock. Available stock is {article.stock_quantity}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if batch is not None and batch.quantity < quantity:
                return Response(
                    {'detail': f'Move exceeds batch quantity. Batch has {batch.quantity} left'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            article.stock_quantity -= quantity
            article.save()
            if batch is not None:
                batch.quantity -= quantity
                batch.save()
        elif movement_type == 'activation':
            if batch is not None:
                batch.status = BatchStatus.IN_SERVICE
                batch.save()
        elif movement_type == 'correction':
            corrected = request.data.get('corrected_quantity')
            if batch is not None and corrected is not None:
                try:
                    corrected = int(corrected)
                except (TypeError, ValueError):
                    return Response(
                        {'detail': 'corrected_quantity must be a whole number'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if corrected < 0:
                    return Response(
                        {'detail': 'corrected_quantity cannot be negative'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                delta = corrected - batch.quantity
                batch.quantity = corrected
                batch.save()
                article.stock_quantity = max(0, article.stock_quantity + delta)
                article.save()

        movement = serializer.save(
            restaurant=restaurant,
            user=request.user,
            user_name=request.user.name,
        )

        check_stock_threshold(article)

        return Response(MovementSerializer(movement).data, status=status.HTTP_201_CREATED)


class MovementDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        assert_restaurant_member(request)
        movement = get_tenant_object_or_404(Movement, request, pk=pk)
        return Response(MovementSerializer(movement).data)
