from rest_framework import serializers
from .models import User

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # WHEN/WHY: surfaced status + permissions for the frontend users panel,
        # then photo_url for the avatar. Originally id/name/email/role/created_at.
        fields = ['id', 'name', 'email', 'role', 'status', 'permissions', 'photo_url', 'is_active', 'created_at']


class CreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        # WHEN/WHY: accept status + permissions on creation (admin create and
        # self-registration). Previously: fields = ['name', 'email', 'password', 'role'].
        fields = ['name', 'email', 'password', 'role', 'status', 'permissions']
        extra_kwargs = {'status': {'required': False}, 'permissions': {'required': False}}

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class SelfUpdateSerializer(serializers.ModelSerializer):
    # WHY: a non-admin must be able to edit their OWN profile (name/email/avatar)
    # without being able to escalate. Admin-only editing of other users (role,
    # status, permissions, is_active) stays on UpdateUserSerializer. Limiting the
    # field set here is the security boundary: role/status/permissions sent by a
    # self-edit are silently ignored, never written. WHEN: added with the
    # self-service profile fix (CODE_REVIEW_PLAN #1).
    class Meta:
        model = User
        fields = ['name', 'email', 'photo_url']


class UpdateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False)

    class Meta:
        model = User
        # WHEN/WHY: allow editing status + permissions (approve/reject/disable +
        # per-user rights) and the avatar (photo_url). Previously: [..., 'role', 'is_active'].
        fields = ['name', 'email', 'password', 'role', 'is_active', 'status', 'permissions', 'photo_url']

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance