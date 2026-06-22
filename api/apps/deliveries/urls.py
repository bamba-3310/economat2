from django.urls import path
from .views import DeliveryListCreateView

urlpatterns = [
    path('', DeliveryListCreateView.as_view()),
]
