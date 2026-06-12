from django.urls import path
from .views import BatchListCreateView, BatchDetailView

urlpatterns = [
    path('', BatchListCreateView.as_view()),
    path('<int:pk>/', BatchDetailView.as_view()),
]