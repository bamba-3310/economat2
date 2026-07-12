from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Article
from .serializers import ArticleSerializer
from apps.permissions import HasAnyAppPermission

# WHEN/WHY: write access was role-based (IsAdminOrEconome), which 403'd users
# holding the matching granular rights the frontend checks (edit_stock /
# edit_thresholds / validate_deliveries). Now mirrors the frontend model;
# admins always pass (see HasAnyAppPermission).
class ArticleListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasAnyAppPermission('edit_stock', 'validate_deliveries')]
        return [IsAuthenticated()]

    def get(self, request):
        """List all articles (all connected)"""
        articles = Article.objects.all().order_by('name')
        return Response(ArticleSerializer(articles, many=True).data)

    def post(self, request):
        """Create an article (Admin/Econome)"""
        serializer = ArticleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        article = serializer.save()
        return Response(ArticleSerializer(article).data, status=status.HTTP_201_CREATED)


class ArticleDetailView(APIView):
    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), HasAnyAppPermission('edit_stock')]
        return [IsAuthenticated(), HasAnyAppPermission('edit_stock', 'edit_thresholds')]

    def patch(self, request, pk):
        """Update an article (Admin/Econome)"""
        try:
            article = Article.objects.get(pk=pk)
        except Article.DoesNotExist:
            return Response({'detail': 'Article does not exist'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ArticleSerializer(article, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ArticleSerializer(article).data)

    def delete(self, request, pk):
        """Delete an article (Admin/Econome)"""
        try:
            article = Article.objects.get(pk=pk)
        except Article.DoesNotExist:
            return Response({'detail': 'Article does not exist'}, status=status.HTTP_404_NOT_FOUND)
        article.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)