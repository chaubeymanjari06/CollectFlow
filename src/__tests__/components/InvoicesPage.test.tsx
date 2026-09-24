import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InvoicesPage } from '../../pages/invoices/InvoicesPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';

describe('InvoicesPage Component (Phase 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render aging tabs, search input, and new invoice button for manager', () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      activeTenant: { tenantId: 'ten_1', name: 'Test Corp', currency: 'INR' } as any,
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
      callback({
        inv_1: {
          invoiceId: 'inv_1',
          tenantId: 'ten_1',
          customerId: 'cust_1',
          customerName: 'Tata Steel Ltd',
          invoiceNumber: 'INV-2026-001',
          invoiceDate: '2026-09-01',
          dueDate: '2026-09-25',
          amount: 50000,
          paidAmount: 0,
          balance: 50000,
          status: 'OVERDUE',
          agingBucket: '1-30',
          daysPastDue: 5,
        },
      });
      return () => {};
    });

    render(<InvoicesPage />);

    expect(screen.getByText('Invoices & Receivables Engine')).toBeInTheDocument();
    expect(screen.getByText('1–30 Days')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search invoice # or party name...')).toBeInTheDocument();
    expect(screen.getByText('New Invoice')).toBeInTheDocument();
    expect(screen.getByText('Tata Steel Ltd')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
  });
});
