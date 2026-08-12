from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Article
from .serializers import ArticleSerializer
from apps.permissions import HasAnyAppPermission
from apps.restaurants.tenancy import assert_restaurant_member, for_restaurant, get_tenant_object_or_404


class ArticleListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasAnyAppPermission('edit_stock', 'validate_deliveries')]
        return [IsAuthenticated()]

    def get(self, request):
        assert_restaurant_member(request)
        articles = for_restaurant(Article.objects.all(), request).order_by('name')
        return Response(ArticleSerializer(articles, many=True).data)

    def post(self, request):
        restaurant = assert_restaurant_member(request)
        serializer = ArticleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        article = serializer.save(restaurant=restaurant)
        return Response(ArticleSerializer(article).data, status=status.HTTP_201_CREATED)


class ArticleDetailView(APIView):
    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), HasAnyAppPermission('edit_stock')]
        return [IsAuthenticated(), HasAnyAppPermission('edit_stock', 'edit_thresholds')]

    def patch(self, request, pk):
        assert_restaurant_member(request)
        article = get_tenant_object_or_404(Article, request, pk=pk)
        serializer = ArticleSerializer(article, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ArticleSerializer(article).data)

    def delete(self, request, pk):
        assert_restaurant_member(request)
        article = get_tenant_object_or_404(Article, request, pk=pk)
        article.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
