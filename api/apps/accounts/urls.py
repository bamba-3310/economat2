from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import LoginView, UserListCreateView, UserDetailView, MeView

urlpatterns = [
    path('login/', LoginView.as_view()),
    path('register/', UserListCreateView.as_view()),
    path('<int:pk>/', UserDetailView.as_view()),
    path('me/', MeView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
]