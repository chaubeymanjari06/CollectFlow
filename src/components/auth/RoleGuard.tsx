import React from 'react';
import { useTenant } from '../../contexts/TenantContext';
import { TenantMembership, UserRole } from '../../types';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: keyof TenantMembership['permissions'];
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  requiredPermission,
  fallback = null,
}) => {
  const { role, hasPermission, isOwner } = useTenant();

  if (isOwner) {
    return <>{children}</>;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <>{fallback}</>;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
