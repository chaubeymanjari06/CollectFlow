import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleGuard } from '../../components/auth/RoleGuard';
import * as TenantContextModule from '../../contexts/TenantContext';

describe('RoleGuard Component', () => {
  it('should render children when user is OWNER', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      role: 'OWNER',
      isOwner: true,
      isAdmin: true,
      isManager: true,
      isExecutive: true,
      isPartner: false,
      isViewer: false,
      hasPermission: vi.fn().mockReturnValue(true),
      activeTenant: null,
      activeMembership: null,
      availableTenants: [],
      loadingTenants: false,
      switchTenant: vi.fn(),
      createCompany: vi.fn(),
      refreshTenantData: vi.fn(),
    });

    render(
      <RoleGuard allowedRoles={['ADMIN']}>
        <div>Owner Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Owner Protected Content')).toBeInTheDocument();
  });

  it('should render fallback when role is not permitted', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      role: 'VIEWER',
      isOwner: false,
      isAdmin: false,
      isManager: false,
      isExecutive: false,
      isPartner: false,
      isViewer: true,
      hasPermission: vi.fn().mockReturnValue(false),
      activeTenant: null,
      activeMembership: null,
      availableTenants: [],
      loadingTenants: false,
      switchTenant: vi.fn(),
      createCompany: vi.fn(),
      refreshTenantData: vi.fn(),
    });

    render(
      <RoleGuard allowedRoles={['ADMIN']} fallback={<div>Access Denied</div>}>
        <div>Admin Only Content</div>
      </RoleGuard>
    );

    expect(screen.queryByText('Admin Only Content')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });
});
