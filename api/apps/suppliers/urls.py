from django.urls import path
from .views import SupplierListCreateView, SupplierDetailView

urlpatterns = [
    path('', SupplierListCreateView.as_view()),
    path('<int:pk>/', SupplierDetailView.as_view()),
]