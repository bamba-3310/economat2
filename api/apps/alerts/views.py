from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Alert
from .serializers import AlertSerializer
from .utils import check_expiration_dates, clean_old_alerts
from apps.restaurants.tenancy import assert_restaurant_member, for_restaurant, get_tenant_object_or_404


class AlertListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        restaurant = assert_restaurant_member(request)
        check_expiration_dates(restaurant)
        clean_old_alerts(restaurant)

        alerts = for_restaurant(Alert.objects.all(), request).order_by('-created_at')

        alert_type = request.query_params.get('type')
        unread = request.query_params.get('unread')

        if alert_type:
            alerts = alerts.filter(type=alert_type)
        if unread == 'true':
            alerts = alerts.filter(read=False)

        return Response(AlertSerializer(alerts, many=True).data)


class AlertDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        assert_restaurant_member(request)
        alert = get_tenant_object_or_404(Alert, request, pk=pk)
        alert.read = True
        alert.save()
        return Response(AlertSerializer(alert).data)


class AlertMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        assert_restaurant_member(request)
        for_restaurant(Alert.objects.filter(read=False), request).update(read=True)
        return Response({'detail': 'All alerts marked as read'}, status=status.HTTP_200_OK)
