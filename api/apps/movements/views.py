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

# WHEN/WHY: POST used to require IsAdminOrEconome for every movement type, which
# blocked cooks (Agents) from the scan flow even though the frontend grants them
# 'edit_stock'/'activate_lot'. The required right now depends on the movement
# type, checked against the user's effective permissions (admins always pass).
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
        """List all movements, can filter by article (all connected)"""
        movements = Movement.objects.all().order_by('-created_at')

        article_id = request.query_params.get('article')
        if article_id:
            movements = movements.filter(article_id=article_id)

        return Response(MovementSerializer(movements, many=True).data)

    @transaction.atomic     # if a step fails, all of it is canceled
    def post(self, request):
        """Create a movement and update the stock (and its batch) atomically.

        WHEN/WHY: the web adapter and the mobile app used to follow a movement
        POST with a separate batch PATCH computed from a stale snapshot — two
        concurrent scanners on the same lot could lose an update, and a failure
        between the two calls left article stock and batch quantity out of sync.
        The batch side-effect (quantity decrement on exits, status flip on
        activation, absolute reset on corrections) now happens HERE, in the same
        transaction, with both rows locked.
        """
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

        article = Article.objects.select_for_update().get(
            pk=serializer.validated_data['article'].id
        )
        batch = None
        if serializer.validated_data.get('batch') is not None:
            batch = Batch.objects.select_for_update().get(
                pk=serializer.validated_data['batch'].id
            )

        if movement_type == 'entry':
            article.stock_quantity += quantity
            article.save()
            if batch is not None:
                batch.quantity += quantity
                batch.save()
        elif movement_type in ('kitchen_exit', 'loss', 'deletion'):
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
            # No quantity change: activating flips the lot reserve -> in service.
            if batch is not None:
                batch.status = BatchStatus.IN_SERVICE
                batch.save()
        elif movement_type == 'correction':
            # Optional absolute reset: `corrected_quantity` is the new batch
            # quantity; the article stock absorbs the real delta. `quantity`
            # stays what the caller logged (the absolute value of the intended
            # delta) for the audit trail.
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

        # Inject the connected user automatically (+ a name snapshot so the
        # history keeps the author even after the account is deleted).
        movement = serializer.save(user=request.user, user_name=request.user.name)

        # Check the threshold after each movement
        check_stock_threshold(article)

        return Response(MovementSerializer(movement).data, status=status.HTTP_201_CREATED)


class MovementDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Movement detail"""
        try:
            movement = Movement.objects.get(pk=pk)
        except Movement.DoesNotExist:
            return Response({'detail': 'Move not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(MovementSerializer(movement).data)
