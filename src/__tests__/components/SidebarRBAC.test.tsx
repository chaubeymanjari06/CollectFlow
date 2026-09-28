import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../../components/layout/Sidebar';
import * as TenantContextModule from '../../contexts/TenantContext';

describe('Sidebar RBAC Menu Isolation Component Tests', () => {
  const createMockTenantContext = (role: any, isOwner: boolean = false) => ({
    activeTenant: { tenantId: 'ten_1', name: 'Test Enterprises', tallyConnected: true } as any,
    activeMembership: null,
    availableTenants: [],
    loadingTenants: false,
    role,
    isOwner,
    isAdmin: isOwner || role === 'ADMIN',
    isManager: isOwner || role === 'ADMIN' || role === 'MANAGER',
    isExecutive: isOwner || role === 'ADMIN' || role === 'MANAGER' || role === 'EXECUTIVE',
    isPartner: role === 'PARTNER',
    isViewer: role === 'VIEWER',
    switchTenant: vi.fn(),
    createCompany: vi.fn(),
    refreshTenantData: vi.fn(),
    hasPermission: vi.fn().mockReturnValue(true),
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('VIEWER should see ONLY 3 menu items and NO diagnostic drawer', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue(
      createMockTenantContext('VIEWER', false)
    );

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // Permitted (3 items)
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Bills')).toBeInTheDocument();
    expect(screen.getByText('Customers 360')).toBeInTheDocument();

    // Strictly Blocked
    expect(screen.queryByText('Payments & UPI')).not.toBeInTheDocument();
    expect(screen.queryByText('Match Payments')).not.toBeInTheDocument();
    expect(screen.queryByText('WhatsApp Follow-ups')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing & Plans')).not.toBeInTheDocument();
    expect(screen.queryByText('Team & Roles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('toggle-diagnostics-drawer')).not.toBeInTheDocument();

    // Role badge
    expect(screen.getByTestId('sidebar-role-badge')).toHaveTextContent('VIEWER');
  });

  it('EXECUTIVE should see ONLY 5 chase items and NO reconciliation or admin areas', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue(
      createMockTenantContext('EXECUTIVE', false)
    );

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // Permitted (5 items)
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Bills')).toBeInTheDocument();
    expect(screen.getByText('Customers 360')).toBeInTheDocument();
    expect(screen.getByText('Payments & UPI')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp Follow-ups')).toBeInTheDocument();

    // Strictly Blocked
    expect(screen.queryByText('Match Payments')).not.toBeInTheDocument();
    expect(screen.queryByText('Collection Intelligence')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Copilot')).not.toBeInTheDocument();
    expect(screen.queryByText('Integrations & Import')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing & Plans')).not.toBeInTheDocument();
    expect(screen.queryByText('Team & Roles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('toggle-diagnostics-drawer')).not.toBeInTheDocument();

    expect(screen.getByTestId('sidebar-role-badge')).toHaveTextContent('EXECUTIVE');
  });

  it('MANAGER (Munimji) should see accounting tools but NOT billing, team, or partner portal', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue(
      createMockTenantContext('MANAGER', false)
    );

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // Permitted
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Bills')).toBeInTheDocument();
    expect(screen.getByText('Customers 360')).toBeInTheDocument();
    expect(screen.getByText('Payments & UPI')).toBeInTheDocument();
    expect(screen.getByText('Match Payments')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp Follow-ups')).toBeInTheDocument();
    expect(screen.getByText('Integrations & Import')).toBeInTheDocument();
    expect(screen.getByText('Settings & Tally Sync')).toBeInTheDocument();

    // Strictly Blocked
    expect(screen.queryByText('Billing & Plans')).not.toBeInTheDocument();
    expect(screen.queryByText('Team & Roles')).not.toBeInTheDocument();
    expect(screen.queryByText('CA / Partner Portal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('toggle-diagnostics-drawer')).not.toBeInTheDocument();

    expect(screen.getByTestId('sidebar-role-badge')).toHaveTextContent('MANAGER');
  });

  it('PARTNER should see CA portal and audit tools but NOT reminder dispatch or billing', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue(
      createMockTenantContext('PARTNER', false)
    );

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // Permitted
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Bills')).toBeInTheDocument();
    expect(screen.getByText('Customers 360')).toBeInTheDocument();
    expect(screen.getByText('Payments & UPI')).toBeInTheDocument();
    expect(screen.getByText('Match Payments')).toBeInTheDocument();
    expect(screen.getByText('CA / Partner Portal')).toBeInTheDocument();

    // Strictly Blocked
    expect(screen.queryByText('WhatsApp Follow-ups')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing & Plans')).not.toBeInTheDocument();
    expect(screen.queryByText('Team & Roles')).not.toBeInTheDocument();

    // Partner has 1 diagnostic item: Security & Compliance
    const diagToggle = screen.getByTestId('toggle-diagnostics-drawer');
    expect(diagToggle).toBeInTheDocument();
    fireEvent.click(diagToggle);
    expect(screen.getByText('Security & Compliance')).toBeInTheDocument();
    expect(screen.queryByText('Operations & Health')).not.toBeInTheDocument();
    expect(screen.queryByText('Pilot Operations')).not.toBeInTheDocument();

    expect(screen.getByTestId('sidebar-role-badge')).toHaveTextContent('PARTNER');
  });

  it('OWNER should see all navigation tools and full diagnostic drawer', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue(
      createMockTenantContext('OWNER', true)
    );

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Bills')).toBeInTheDocument();
    expect(screen.getByText('Customers 360')).toBeInTheDocument();
    expect(screen.getByText('Payments & UPI')).toBeInTheDocument();
    expect(screen.getByText('Match Payments')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp Follow-ups')).toBeInTheDocument();
    expect(screen.getByText('Collection Intelligence')).toBeInTheDocument();
    expect(screen.getByText('AI Copilot')).toBeInTheDocument();
    expect(screen.getByText('Integrations & Import')).toBeInTheDocument();
    expect(screen.getByText('CA / Partner Portal')).toBeInTheDocument();
    expect(screen.getByText('Billing & Plans')).toBeInTheDocument();
    expect(screen.getByText('Team & Roles')).toBeInTheDocument();
    expect(screen.getByText('Settings & Tally Sync')).toBeInTheDocument();

    // Full diagnostics drawer
    const diagToggle = screen.getByTestId('toggle-diagnostics-drawer');
    expect(diagToggle).toBeInTheDocument();
    fireEvent.click(diagToggle);
    expect(screen.getByText('Operations & Health')).toBeInTheDocument();
    expect(screen.getByText('Security & Compliance')).toBeInTheDocument();
    expect(screen.getByText(/Pilot Operations/)).toBeInTheDocument();

    expect(screen.getByTestId('sidebar-role-badge')).toHaveTextContent('OWNER');
  });
});
