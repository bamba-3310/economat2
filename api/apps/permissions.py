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