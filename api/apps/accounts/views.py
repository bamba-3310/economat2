import uuid

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
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


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(email=serializer.validated_data['email'])
        except User.DoesNotExist:
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(serializer.validated_data['password']):
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        # WHEN/WHY: the original only checked is_active. With the new account
        # workflow we also reject non-active statuses and return the status code
        # so the frontend can show the right message (pending/rejected/disabled).
        # Previous code:
        #   if not user.is_active:
        #       return Response({'detail': 'Inactive user'}, status=status.HTTP_403_FORBIDDEN)
        if user.status != UserStatus.ACTIVE or not user.is_active:
            return Response(
                {'detail': 'Account not active', 'status': user.status},
                status=status.HTTP_403_FORBIDDEN,
            )

        # WHEN/WHY: single active session, takeover semantics. The newest login
        # always wins: we mint a fresh session id and overwrite any existing one,
        # so the previous session's token (whose `sid` no longer matches) is
        # invalidated on its next request (see SessionJWTAuthentication). This
        # guarantees a user can always log in again — a closed browser or a
        # killed server can no longer lock the account out. Idle sessions also
        # free themselves after SESSION_IDLE_TIMEOUT.
        # Previous behaviour blocked the 2nd login with 409 'Already logged in
        # elsewhere' for the full access-token lifetime, which caused lockouts.
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

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class UserListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        """List all users (Admin only)"""
        users = User.objects.all().order_by('name')
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):
        """Create a user (Admin only)"""
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User does not exist'}, status=status.HTTP_404_NOT_FOUND)
        serializer = UpdateUserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, pk):
        """Delete a user (Admin only, except oneself)"""
        if request.user.pk == pk:
            return  Response({'detail': 'You cannot delete yourself'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User does not exist'}, status=status.HTTP_404_NOT_FOUND)
        user.delete()
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
        request.user.set_password(new)
        request.user.save()
        return Response({'detail': 'Password updated'})


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

    def post(self, request):
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
        serializer.save()
        return Response(
            {'detail': 'Account requested', 'status': UserStatus.PENDING},
            status=status.HTTP_201_CREATED,
        )