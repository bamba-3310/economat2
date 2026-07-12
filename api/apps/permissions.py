from rest_framework.permissions import BasePermission

class IsAdmin(BasePermission):
    """Reserved to administrators"""
    message = 'Reserved to administrators'

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'admin'
        )


class IsAdminOrEconome(BasePermission):
    """Admin or Econome"""
    message = 'Reserved to administrators or Economes'

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('admin', 'econome')
        )


# WHEN/WHY: the frontend grants granular per-user rights (User.permissions) and
# falls back to per-role defaults when the list is empty — but the Django views
# only ever checked ROLE (IsAdminOrEconome). A cook (Agent) holding
# 'edit_stock'/'activate_lot' therefore always got a 403 on the scan endpoints
# even though the UI offered the action. These helpers mirror the frontend's
# model (src/server/mappers.ts DEFAULT_PERMISSIONS) so both layers agree:
# explicit permissions win; an empty list means the role's defaults; admins
# always pass. Keep the two default tables in sync.
ALL_APP_PERMISSIONS = [
    'manage_users', 'approve_accounts', 'edit_stock', 'edit_lots',
    'edit_thresholds', 'edit_expiration_dates', 'validate_deliveries',
    'activate_lot', 'view_all_alerts', 'manage_categories',
]

ROLE_DEFAULT_PERMISSIONS = {
    'admin': ALL_APP_PERMISSIONS,
    'econome': [
        'edit_stock', 'edit_lots', 'edit_thresholds', 'edit_expiration_dates',
        'validate_deliveries', 'activate_lot', 'view_all_alerts', 'manage_categories',
    ],
    'cook': ['edit_stock', 'activate_lot'],
}


def effective_permissions(user):
    explicit = getattr(user, 'permissions', None) or []
    if explicit:
        return explicit
    return ROLE_DEFAULT_PERMISSIONS.get(getattr(user, 'role', ''), [])


def user_has_any_permission(user, permissions):
    """True when the user is an admin or holds ANY of `permissions`."""
    if not (user and user.is_authenticated):
        return False
    if user.role == 'admin':
        return True
    held = effective_permissions(user)
    return any(permission in held for permission in permissions)


class HasAnyAppPermission(BasePermission):
    """Instance-based check: allow admins, or users holding any listed right.

    Used from get_permissions() (which returns instances), e.g.:
        return [IsAuthenticated(), HasAnyAppPermission('edit_lots', 'edit_stock')]
    """
    message = 'Missing permission for this action'

    def __init__(self, *permissions):
        self.permissions = permissions

    def has_permission(self, request, view):
        return user_has_any_permission(request.user, self.permissions)
