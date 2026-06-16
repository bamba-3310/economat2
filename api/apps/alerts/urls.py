from django.urls import path
from .views import AlertListView, AlertDetailView, AlertMarkAllReadView

urlpatterns = [
    path('', AlertListView.as_view()),
    path('<int:pk>/', AlertDetailView.as_view()),
    path('read-all/', AlertMarkAllReadView.as_view()),
]