import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemindersPage } from '../../pages/reminders/RemindersPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';

describe('RemindersPage Component (Phase 5 & 6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render WhatsApp collection header, action buttons, and tabs', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      activeTenant: { tenantId: 'ten_1', name: 'Shree Enterprises', currency: 'INR' } as any,
      activeMembership: null,
      availableTenants: [],
      loadingTenants: false,
      role: 'MANAGER',
      isOwner: false,
      isAdmin: false,
      isManager: true,
      isExecutive: true,
      isPartner: false,
      isViewer: false,
      switchTenant: vi.fn(),
      createCompany: vi.fn(),
      refreshTenantData: vi.fn(),
      hasPermission: vi.fn(),
    });

    vi.spyOn(dbService, 'subscribe').mockImplementation((_path: string, callback: any) => {
      callback({});
      return () => {};
    });

    render(<RemindersPage />);

    expect(screen.getByText('WhatsApp Collections & Promise-to-Pay')).toBeInTheDocument();
    expect(screen.getByText('Run Automated Sequence')).toBeInTheDocument();
    expect(screen.getByText('Log PTP')).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp Logs/i)).toBeInTheDocument();
    expect(screen.getByText(/Promises to Pay/i)).toBeInTheDocument();
    expect(screen.getByText('Deduplication Protection')).toBeInTheDocument();
  });
});
