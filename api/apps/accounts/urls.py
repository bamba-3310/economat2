from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import LoginView, LogoutView, UserListCreateView, UserDetailView, MeView, RegisterView, ChangePasswordView

urlpatterns = [
    path('login/', LoginView.as_view()),
    # WHEN/WHY: clears the single active session so the user can log in again.
    path('logout/', LogoutView.as_view()),
    # WHEN/WHY: public account-request endpoint for the frontend "Demande" flow.
    path('register/', RegisterView.as_view()),
    # WHEN/WHY: self-service password change (verifies current password).
    path('change-password/', ChangePasswordView.as_view()),
    path('me/', MeView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
    path('', UserListCreateView.as_view()),
    path('<int:pk>/', UserDetailView.as_view()),
]