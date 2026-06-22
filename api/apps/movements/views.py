from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from apps.alerts.utils import check_stock_threshold
from .models import Movement
from .serializers import MovementSerializer
from apps.permissions import IsAdminOrEconome
from apps.articles.models import Article

class MovementListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsAdminOrEconome()]
        return [IsAuthenticated()]

    def get(self, request):
        """List all movements, can filter by article (all connected)"""
        movements = Movement.objects.all().order_by('-created_at')

        article_id = request.query_params.get('article')
        if article_id:
            movements = movements.filter(article_id=article_id)

        return Response(MovementSerializer(movements, many=True).data)

    @transaction.atomic     # if a step fails, all of it is canceled
    def post(self, request):
        """Create a movement and update the stock"""
        serializer = MovementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        article = Article.objects.select_for_update().get(
            pk=serializer.validated_data['article'].id
        )

        quantity = serializer.validated_data['quantity']
        movement_type = serializer.validated_data['type']

        # WHEN/WHY: the new 'activation' (lot reserve -> in service) and
        # 'correction' movement types must NOT auto add/subtract the article
        # stock here — activation changes no quantity, and corrections are
        # reconciled explicitly by the caller (batch + article stock are set to
        # the corrected value). The original code treated every non-'entry' type
        # as a subtraction, which would be wrong for these two.
        # Previous code:
        #   if movement_type == 'entry':
        #       article.stock_quantity += quantity
        #   else:
        #       if article.stock_quantity < quantity: return Response({...})
        #       article.stock_quantity -= quantity
        #   article.save()
        if movement_type == 'entry':
            article.stock_quantity += quantity
            article.save()
        elif movement_type in ('kitchen_exit', 'loss', 'deletion'):
            if article.stock_quantity < quantity:
                return Response(
                    {'detail': f'Move not enough stock. Available stock is {article.stock_quantity}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            article.stock_quantity -= quantity
            article.save()
        # 'activation' / 'correction': no automatic stock change (logged only).

        # Inject the connected user automatically
        movement = serializer.save(user=request.user)

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