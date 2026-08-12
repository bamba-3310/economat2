import uuid

from django.contrib.auth.password_validation import validate_password as validate_password_strength
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import ProtectedError
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, UserStatus, UserRole
from .serializers import (
    LoginSerializer,
    UserSerializer,
    CreateUserSerializer,
    UpdateUserSerializer,
    SelfUpdateSerializer,
)
from apps.permissions import IsAdmin
from apps.restaurants.models import RestaurantMembership
from apps.restaurants.tenancy import assert_restaurant_member, require_restaurant, user_belongs_to


def _issue_session_tokens(user):
    """Mint a fresh single-session id + JWT pair bound to it (sid claim)."""
    now = timezone.now()
    session_id = uuid.uuid4()
    user.active_session_id = session_id
    user.session_started_at = now
    user.session_last_seen = now
    user.save(update_fields=['active_session_id', 'session_started_at', 'session_last_seen'])

    refresh = RefreshToken.for_user(user)
    # Claims copied onto the access token (role for the frontend; sid binds
    # the token to this single session — see SessionJWTAuthentication).
    refresh['role'] = user.role
    refresh['sid'] = str(session_id)
    return refresh


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        restaurant = require_restaurant(request)

        user = (
            User.objects
            .filter(email__iexact=serializer.validated_data['email'])
            .order_by('id')
            .first()
        )
        if user is None or not user.check_password(serializer.validated_data['password']):
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        if user.status != UserStatus.ACTIVE or not user.is_active:
            return Response(
                {'detail': 'Account not active', 'status': user.status},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not user_belongs_to(user, restaurant):
            return Response(
                {'detail': 'Not a member of this restaurant'},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = _issue_session_tokens(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
            'restaurant': {'id': restaurant.id, 'slug': restaurant.slug, 'name': restaurant.name},
        })


class UserListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        restaurant = assert_restaurant_member(request)
        users = User.objects.filter(memberships__restaurant=restaurant).distinct().order_by('name')
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):
        restaurant = assert_restaurant_member(request)
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        RestaurantMembership.objects.get_or_create(user=user, restaurant=restaurant)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        restaurant = assert_restaurant_member(request)
        try:
            user = User.objects.get(pk=pk, memberships__restaurant=restaurant)
        except User.DoesNotExist:
            return Response({'detail': 'User does not exist'}, status=status.HTTP_404_NOT_FOUND)
        serializer = UpdateUserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, pk):
        """Delete a user (Admin only, except oneself)"""
        restaurant = assert_restaurant_member(request)
        if request.user.pk == pk:
            return Response({'detail': 'You cannot delete yourself'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(pk=pk, memberships__restaurant=restaurant)
        except User.DoesNotExist:
            return Response({'detail': 'User does not exist'}, status=status.HTTP_404_NOT_FOUND)
        # Remove membership for this restaurant; delete account if orphaned.
        RestaurantMembership.objects.filter(user=user, restaurant=restaurant).delete()
        if user.memberships.exists():
            return Response(status=status.HTTP_204_NO_CONTENT)
        try:
            user.delete()
        except ProtectedError:
            return Response(
                {'detail': 'User still has protected history and cannot be deleted'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return the profil of the current user"""
        return Response(UserSerializer(request.user).data)

    # WHY: self-service profile edit. The admin-only UserDetailView.patch blocked
    # a Gestionnaire/Agent from changing their own name/email/avatar. This lets
    # any authenticated user edit ONLY their own safe fields (SelfUpdateSerializer
    # whitelists name/email/photo_url) — role/status/permissions are never
    # writable here. WHEN: added for CODE_REVIEW_PLAN #1.
    def patch(self, request):
        serializer = SelfUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


# WHY: a user must be able to change their OWN password from the profile screen.
# The only password-write path was admin-only (UserDetailView) and never checked
# the current password. WHEN: added during the PostgreSQL/Django wiring.
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = request.data.get('current_password')
        new = request.data.get('new_password')
        if not current or not new:
            return Response({'detail': 'current_password and new_password required'},
                            status=status.HTTP_400_BAD_REQUEST)
        if len(new) < 8:
            return Response({'detail': 'Password too short'}, status=status.HTTP_400_BAD_REQUEST)
        if not request.user.check_password(current):
            return Response({'detail': 'Current password incorrect'}, status=status.HTTP_400_BAD_REQUEST)

        # WHEN/WHY: DRF serializers never run AUTH_PASSWORD_VALIDATORS on their
        # own; enforce the configured policy here (similarity to the user's own
        # attributes, common/numeric passwords, min length).
        try:
            validate_password_strength(new, user=request.user)
        except DjangoValidationError as exc:
            return Response({'detail': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new)
        request.user.save()

        # WHEN/WHY: rotate the session on password change so tokens minted for
        # the old password stop working (the old `sid` no longer matches). Fresh
        # tokens are returned so the caller's own session continues seamlessly.
        refresh = _issue_session_tokens(request.user)
        return Response({
            'detail': 'Password updated',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })


# WHY: clearing the active session frees the single-session lock immediately so
# the user can log in again (e.g. on another device). WHEN: added with the
# single-session feature.
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.active_session_id = None
        request.user.session_started_at = None
        request.user.session_last_seen = None
        request.user.save(update_fields=['active_session_id', 'session_started_at', 'session_last_seen'])
        return Response({'detail': 'Logged out'})


# WHY: the frontend login screen has a "request an account" (Demande) flow that
# must work without authentication and create a PENDING account an admin later
# approves. The only create path was admin-only (UserListCreateView.post).
# WHEN: added during the PostgreSQL/Django wiring.
class RegisterView(APIView):
    permission_classes = [AllowAny]
    # WHEN/WHY: open registration with no throttle allowed unlimited pending-
    # account spam. Scoped rate lives in settings.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'

    def post(self, request):
        restaurant = require_restaurant(request)
        data = {
            'name': request.data.get('name'),
            'email': request.data.get('email'),
            'password': request.data.get('password'),
            # Self-registration can never grant admin; default to econome unless
            # the request explicitly asks for cook.
            'role': UserRole.COOK if request.data.get('role') == UserRole.COOK else UserRole.ECONOME,
            'status': UserStatus.PENDING,
            'permissions': [],
        }
        serializer = CreateUserSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        RestaurantMembership.objects.get_or_create(user=user, restaurant=restaurant)
        return Response(
            {'detail': 'Account requested', 'status': UserStatus.PENDING},
            status=status.HTTP_201_CREATED,
        )
