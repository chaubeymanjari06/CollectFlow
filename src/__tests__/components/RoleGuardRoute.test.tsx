import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoleGuard } from '../../components/auth/RoleGuard';
import * as TenantContextModule from '../../contexts/TenantContext';
import { TenantContextType } from '../../contexts/TenantContext';
import { UserRole } from '../../types';

describe('RoleGuard Route Protection & Access Denied Tests', () => {
  const createMockContext = (overrides: Partial<TenantContextType> = {}): TenantContextType => ({
    activeTenant: { tenantId: 'ten_1', name: 'Test Enterprises' } as any,
    activeMembership: null,
    availableTenants: [],
    loadingTenants: false,
    role: 'EXECUTIVE' as UserRole | null,
    isOwner: false,
    isAdmin: false,
    isManager: false,
    isExecutive: true,
    isPartner: false,
    isViewer: false,
    switchTenant: vi.fn(),
    createCompany: vi.fn(),
    refreshTenantData: vi.fn(),
    hasPermission: vi.fn().mockReturnValue(false),
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render children when user role is authorized', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue(
      createMockContext({ role: 'MANAGER', isManager: true })
    );

    render(
      <MemoryRouter>
        <RoleGuard allowedRoles={['OWNER', 'ADMIN', 'MANAGER']} areaName="Reconciliation">
          <div>Authorized Reconciliation Content</div>
        </RoleGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Authorized Reconciliation Content')).toBeInTheDocument();
  });

  it('should render AccessDeniedPage when user role is unauthorized', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue(
      createMockContext({ role: 'EXECUTIVE', isExecutive: true })
    );

    render(
      <MemoryRouter>
        <RoleGuard allowedRoles={['OWNER', 'ADMIN']} areaName="Billing & Plans">
          <div>Secret Billing Content</div>
        </RoleGuard>
      </MemoryRouter>
    );

    // Protected content must NOT be shown
    expect(screen.queryByText('Secret Billing Content')).not.toBeInTheDocument();

    // Access Denied screen elements
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/Billing & Plans/i)).toBeInTheDocument();
    expect(screen.getByText(/EXECUTIVE/i)).toBeInTheDocument();
    expect(screen.getByText('OWNER')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByText('Allowed Dashboard')).toBeInTheDocument();
  });

  it('should render custom fallback if explicitly provided', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue(
      createMockContext({ role: 'VIEWER', isViewer: true })
    );

    render(
      <MemoryRouter>
        <RoleGuard allowedRoles={['OWNER']} fallback={<div>Custom Forbidden Message</div>}>
          <div>Owner Only Page</div>
        </RoleGuard>
      </MemoryRouter>
    );

    expect(screen.getByText('Custom Forbidden Message')).toBeInTheDocument();
    expect(screen.queryByText('Owner Only Page')).not.toBeInTheDocument();
  });

  it('should render loading spinner while loadingTenants is true', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue(
      createMockContext({ loadingTenants: true })
    );

    const { container } = render(
      <MemoryRouter>
        <RoleGuard allowedRoles={['OWNER']}>
          <div>Owner Page</div>
        </RoleGuard>
      </MemoryRouter>
    );

    expect(screen.queryByText('Owner Page')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
