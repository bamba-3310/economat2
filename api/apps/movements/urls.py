from django.urls import path
from .views import MovementListCreateView, MovementDetailView

urlpatterns = [
    path('', MovementListCreateView.as_view()),
    path('<int:pk>/', MovementDetailView.as_view()),
]