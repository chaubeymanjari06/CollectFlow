import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaymentsPage } from '../../pages/payments/PaymentsPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import * as AuthContextModule from '../../contexts/AuthContext';
import { paymentService } from '../../services/paymentService';
import { dbService } from '../../services/dbService';

describe('PaymentsPage Component (Phase 7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render metric summary cards, action buttons, and payment records', async () => {
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

    vi.spyOn(paymentService, 'getPayments').mockResolvedValue([
      {
        paymentId: 'pay_9911',
        tenantId: 'ten_1',
        customerId: 'cust_1',
        customerName: 'Jindal Steel',
        source: 'razorpay',
        provider: 'razorpay',
        amount: 85000,
        currency: 'INR',
        paymentDate: '2026-09-24T10:00:00Z',
        status: 'SUCCESS',
        reconciliationStatus: 'PARTIALLY_MATCHED',
        matchedAmount: 50000,
        unmatchedBalance: 35000,
        utr: 'UTR99112233',
        idempotencyKey: 'idem_9911',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    vi.spyOn(dbService, 'get').mockResolvedValue({});

    render(
      <MemoryRouter>
        <PaymentsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Payments & UPI Ingestion')).toBeInTheDocument();
    expect(screen.getByText('Simulate Webhook')).toBeInTheDocument();
    expect(screen.getByText('Record Manual Receipt')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Jindal Steel')).toBeInTheDocument();
      expect(screen.getByText('pay_9911')).toBeInTheDocument();
      expect(screen.getByText('UTR99112233')).toBeInTheDocument();
    });
  });
});
