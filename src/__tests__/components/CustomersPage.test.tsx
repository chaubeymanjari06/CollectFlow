import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomersPage } from '../../pages/customers/CustomersPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';

describe('CustomersPage Component (Customer 360)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render customer list with overdue balance and add customer button', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      activeTenant: { tenantId: 'ten_1', name: 'Test Corp', currency: 'INR' } as any,
      activeMembership: null,
      availableTenants: [],
      loadingTenants: false,
      role: 'ADMIN',
      isOwner: false,
      isAdmin: true,
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
      callback({
        cust_1: {
          customerId: 'cust_1',
          tenantId: 'ten_1',
          name: 'Reliance Logistics',
          mobile: '+919820098200',
          creditLimit: 500000,
          paymentTerms: 30,
          metrics: {
            totalReceivable: 120000,
            overdueBalance: 45000,
            openInvoicesCount: 2,
            overdueInvoicesCount: 1,
            averagePaymentDelayDays: 14,
            ptpSuccessRate: 90,
          },
          status: 'ACTIVE',
        },
      });
      return () => {};
    });

    render(<CustomersPage />);

    expect(screen.getByText('Customer 360 & Ledger')).toBeInTheDocument();
    expect(screen.getByText('Reliance Logistics')).toBeInTheDocument();
    expect(screen.getByText('+919820098200')).toBeInTheDocument();
    expect(screen.getByText('Add Customer')).toBeInTheDocument();
  });
});
