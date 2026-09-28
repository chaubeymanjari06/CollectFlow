import React from 'react';
import { useTenant } from '../../contexts/TenantContext';
import { TenantMembership, UserRole } from '../../types';
import { AccessDeniedPage } from './AccessDeniedPage';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: keyof TenantMembership['permissions'];
  fallback?: React.ReactNode;
  areaName?: string;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  requiredPermission,
  fallback,
  areaName,
}) => {
  const { role, hasPermission, isOwner, loadingTenants } = useTenant();

  if (loadingTenants) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isOwner) {
    return <>{children}</>;
  }

  const isRoleDenied = allowedRoles && (!role || !allowedRoles.includes(role));
  const isPermDenied = requiredPermission && !hasPermission(requiredPermission);

  if (isRoleDenied || isPermDenied) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }
    return <AccessDeniedPage allowedRoles={allowedRoles} areaName={areaName} />;
  }

  return <>{children}</>;
};
