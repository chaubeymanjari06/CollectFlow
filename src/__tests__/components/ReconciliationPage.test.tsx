import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReconciliationPage } from '../../pages/reconciliation/ReconciliationPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import * as AuthContextModule from '../../contexts/AuthContext';
import { reconciliationService } from '../../services/reconciliationService';
import { paymentService } from '../../services/paymentService';
import { dbService } from '../../services/dbService';

describe('ReconciliationPage Component (Phase 8 & 9)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render confidence tiers, tabs, and pending approvals', async () => {
    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      activeTenant: { tenantId: 'ten_1', name: 'Alpha Traders', currency: 'INR' } as any,
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

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      currentUser: { uid: 'u_1', email: 'harish@alpha.in' } as any,
      userProfile: { userId: 'u_1', name: 'Harish Mehta', email: 'harish@alpha.in' } as any,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.spyOn(reconciliationService, 'getReconciliations').mockResolvedValue([
      {
        reconciliationId: 'rec_pend_88',
        tenantId: 'ten_1',
        paymentId: 'pay_88',
        customerId: 'cust_88',
        customerName: 'Kalyan Jewellers & Ornaments',
        paymentAmount: 120000,
        totalAllocated: 120000,
        allocations: [
          {
            invoiceId: 'inv_88',
            invoiceNumber: 'INV-2026-0888',
            allocatedAmount: 120000,
            invoiceBalanceBefore: 120000,
            invoiceBalanceAfter: 0,
          },
        ],
        confidenceScore: 85,
        matchRule: 'UTR_MATCH',
        status: 'PENDING_APPROVAL',
        tallyWriteBackStatus: 'NOT_REQUIRED',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    vi.spyOn(paymentService, 'getPayments').mockResolvedValue([]);
    vi.spyOn(reconciliationService, 'getTallyVoucherCommands').mockResolvedValue([
      {
        commandId: 'cmd_1',
        tenantId: 'ten_1',
        reconciliationId: 'rec_1',
        voucherType: 'Receipt',
        voucherDate: '20260924',
        partyLedger: 'Kalyan Jewellers & Ornaments',
        bankOrCashLedger: 'HDFC Bank',
        amount: 120000,
        narration: 'Auto-reconciled',
        billsAllocated: [{ billNumber: 'INV-2026-0888', billAmount: 120000 }],
        status: 'QUEUED',
        attemptCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    vi.spyOn(dbService, 'get').mockResolvedValue({});

    render(
      <MemoryRouter>
        <ReconciliationPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Confidence-Based Reconciliation Engine')).toBeInTheDocument();
    expect(screen.getByText('95%–100% Auto-Reconciliation')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('85% Confidence Match')).toBeInTheDocument();
      expect(screen.getByText('Customer: Kalyan Jewellers & Ornaments')).toBeInTheDocument();
      expect(screen.getByText('Approve Match')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });
  });
});
