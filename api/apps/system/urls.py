from django.urls import path
from .views import BrandingView, WipeDatabaseView

urlpatterns = [
    path('branding/', BrandingView.as_view()),
    path('wipe/', WipeDatabaseView.as_view()),
]
