from django.urls import path
from .views import ArticleListCreateView, ArticleDetailView

urlpatterns = [
    path('', ArticleListCreateView.as_view()),
    path('<int:pk>/', ArticleDetailView.as_view()),
]