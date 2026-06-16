from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Alert
from .serializers import AlertSerializer
from .utils import check_expiration_dates, clean_old_alerts


class AlertListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """List all alerts, can filter by type or status"""
        check_expiration_dates()
        clean_old_alerts()

        alerts = Alert.objects.all().order_by('-created_at')

        # Optional filters
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
        """Mark an alert as read"""
        try:
            alert = Alert.objects.get(pk=pk)
        except Alert.DoesNotExist:
            return Response({'detail': 'Alert not found'}, status=status.HTTP_404_NOT_FOUND)

        alert.read = True
        alert.save()
        return Response(AlertSerializer(alert).data)


class AlertMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Mark all alerts as read"""
        Alert.objects.filter(read=False).update(read=True)
        return Response({'detail': 'All alerts marked as read'}, status=status.HTTP_200_OK)