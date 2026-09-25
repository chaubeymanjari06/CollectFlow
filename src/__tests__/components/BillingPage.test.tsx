import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BillingPage } from '../../pages/billing/BillingPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import * as AuthContextModule from '../../contexts/AuthContext';
import { billingService } from '../../services/billingService';

describe('BillingPage Component (Phase 15)', () => {
  const mockTenant = {
    tenantId: 'ten_demo_corp',
    name: 'Apex Steel & Industrial Supplies Pvt Ltd',
    legalName: 'Apex Steel & Industrial Supplies Private Limited',
    gstin: '27AABCA1234F1Z8',
    currency: 'INR',
  };

  const mockSubscription = {
    subscriptionId: 'sub_demo_123',
    tenantId: 'ten_demo_corp',
    planId: 'growth',
    billingInterval: 'MONTHLY',
    status: 'ACTIVE',
    currentPeriodStart: Date.now() - 5 * 86400000,
    currentPeriodEnd: Date.now() + 25 * 86400000,
    trialStart: Date.now() - 5 * 86400000,
    trialEnd: Date.now() + 9 * 86400000,
    cancelAtPeriodEnd: false,
    usage: {
      invoicesCount: 42,
      customersCount: 18,
      whatsAppMessagesSent: 120,
      whatsAppLimit: 1000,
      whatsAppOverageCostINR: 0,
      activeUsersCount: 3,
      activeDevicesCount: 2,
    },
    paymentMethod: {
      type: 'UPI',
      brandOrBank: 'HDFC Bank',
      upiVpa: 'apexsteel@hdfcbank',
    },
    createdAt: Date.now() - 30 * 86400000,
    updatedAt: Date.now(),
  };

  const mockInvoices = [
    {
      invoiceId: 'binv_01',
      invoiceNumber: 'CF-INV-2026-1048',
      tenantId: 'ten_demo_corp',
      subscriptionId: 'sub_demo_123',
      planName: 'Growth Automation Pro (Monthly Plan)',
      billingInterval: 'MONTHLY',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      baseAmount: 2999,
      taxRatePct: 18,
      taxAmount: 540,
      totalAmount: 3539,
      currency: 'INR',
      sacCode: '998314',
      status: 'PAID',
      paymentDate: '2026-08-01',
      paymentMethod: 'UPI (apexsteel@hdfcbank)',
      utrOrReference: 'HDFC-UPI-99221188',
      createdAt: Date.now() - 30 * 86400000,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock URL object methods for download
    window.URL.createObjectURL = vi.fn().mockReturnValue('mock-blob-url');
    window.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      currentUser: { uid: 'usr_admin', email: 'admin@apexsteel.com' } as any,
      userProfile: { userId: 'usr_admin', name: 'Rajesh Sharma', email: 'admin@apexsteel.com' } as any,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      activeTenant: mockTenant as any,
      activeMembership: null,
      availableTenants: [mockTenant as any],
      loadingTenants: false,
      role: 'OWNER',
      isOwner: true,
      isAdmin: false,
      isManager: false,
      isExecutive: false,
      isPartner: false,
      isViewer: false,
      switchTenant: vi.fn(),
      createCompany: vi.fn(),
      refreshTenantData: vi.fn().mockResolvedValue(undefined),
      hasPermission: vi.fn().mockReturnValue(true),
    });

    vi.spyOn(billingService, 'getSubscription').mockResolvedValue(mockSubscription as any);
    vi.spyOn(billingService, 'getBillingInvoices').mockResolvedValue(mockInvoices as any);
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <BillingPage />
      </MemoryRouter>
    );

  it('should render the billing page with current plan banner, usage meters, and plan options', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Subscription & Monetization')).toBeInTheDocument();
      expect(screen.getByText('Phase 15')).toBeInTheDocument();
    });

    // Check banner
    expect(screen.getAllByText('Growth Automation Pro').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Current Billing Cycle Usage Meters')).toBeInTheDocument();

    // Check meters
    expect(screen.getByText('Invoices Processed')).toBeInTheDocument();
    expect(screen.getByText('Customer 360 Ledgers')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp Reminders')).toBeInTheDocument();
    expect(screen.getByText('Team & Devices')).toBeInTheDocument();

    // Check plan cards
    expect(screen.getByText('Starter MSME')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Automation')).toBeInTheDocument();

    // Check invoice table
    expect(screen.getByText('CF-INV-2026-1048')).toBeInTheDocument();
    expect(screen.getByText('₹3,539')).toBeInTheDocument();
  });

  it('should toggle between monthly and annual pricing', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Monthly Billing')).toBeInTheDocument();
    });

    const annualBtn = screen.getByText('Annual Billing');
    fireEvent.click(annualBtn);

    // After switching to annual billing, Starter is ₹9,990/year instead of ₹999/month
    await waitFor(() => {
      expect(screen.getByText('₹9,990')).toBeInTheDocument();
      expect(screen.getByText('₹28,990')).toBeInTheDocument();
    });
  });

  it('should trigger plan upgrade when clicking an available plan', async () => {
    const changePlanSpy = vi.spyOn(billingService, 'changePlan').mockResolvedValue({
      ...mockSubscription,
      planId: 'enterprise',
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Select Enterprise Automation')).toBeInTheDocument();
    });

    const enterpriseBtn = screen.getByText('Select Enterprise Automation');
    fireEvent.click(enterpriseBtn);

    await waitFor(() => {
      expect(changePlanSpy).toHaveBeenCalledWith('ten_demo_corp', 'enterprise', 'MONTHLY');
    });
  });

  it('should open and submit payment method modal', async () => {
    const updatePaymentSpy = vi.spyOn(billingService, 'updatePaymentMethod').mockResolvedValue({
      ...mockSubscription,
      paymentMethod: { type: 'UPI', upiVpa: 'newapex@icici' },
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('apexsteel@hdfcbank')).toBeInTheDocument();
    });

    // Click payment method button
    fireEvent.click(screen.getByText('apexsteel@hdfcbank'));

    expect(screen.getByText('Update Billing Payment Method')).toBeInTheDocument();

    // Update UPI input
    const input = screen.getByPlaceholderText('e.g. shreeenterprises@hdfcbank');
    fireEvent.change(input, { target: { value: 'newapex@icici' } });

    // Submit modal
    const saveBtn = screen.getByText('Save Payment Method');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updatePaymentSpy).toHaveBeenCalledWith('ten_demo_corp', {
        type: 'UPI',
        brandOrBank: 'UPI AutoPay (NPCI)',
        upiVpa: 'newapex@icici',
      });
    });
  });

  it('should open cancel modal and cancel subscription', async () => {
    const cancelSpy = vi.spyOn(billingService, 'cancelSubscription').mockResolvedValue({
      ...mockSubscription,
      cancelAtPeriodEnd: true,
      cancellationReason: 'Reducing costs',
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Cancel Plan')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel Plan'));

    expect(screen.getByText('Cancel Subscription?')).toBeInTheDocument();

    // Enter reason
    const textarea = screen.getByPlaceholderText('Let us know how we can improve...');
    fireEvent.change(textarea, { target: { value: 'Reducing costs' } });

    // Confirm cancellation
    const confirmBtn = screen.getByText('Confirm Cancellation');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith('ten_demo_corp', 'Reducing costs', false);
    });
  });

  it('should show reactivate button if subscription is set to cancel at period end', async () => {
    vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
      ...mockSubscription,
      cancelAtPeriodEnd: true,
    } as any);

    const reactivateSpy = vi.spyOn(billingService, 'reactivateSubscription').mockResolvedValue({
      ...mockSubscription,
      cancelAtPeriodEnd: false,
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Reactivate Plan')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Reactivate Plan'));

    await waitFor(() => {
      expect(reactivateSpy).toHaveBeenCalledWith('ten_demo_corp');
    });
  });

  it('should display grace period warning banner if status is GRACE_PERIOD', async () => {
    vi.spyOn(billingService, 'getSubscription').mockResolvedValue({
      ...mockSubscription,
      status: 'GRACE_PERIOD',
      gracePeriodEnd: Date.now() + 6 * 86400000,
    } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Your recent subscription payment failed/i)).toBeInTheDocument();
      expect(screen.getByText(/avoid suspension of automated WhatsApp/i)).toBeInTheDocument();
    });
  });

  it('should simulate webhook event in the webhook test console', async () => {
    const webhookSpy = vi.spyOn(billingService, 'handleSubscriptionWebhook').mockResolvedValue({
      success: true,
      message: 'Subscription renewed successfully through period 2026-10-31',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Subscription Webhook Test Console')).toBeInTheDocument();
      expect(screen.getByText('Dispatch Webhook Event')).toBeInTheDocument();
    });

    const dispatchBtn = screen.getByText('Dispatch Webhook Event');
    fireEvent.click(dispatchBtn);

    await waitFor(() => {
      expect(webhookSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'subscription.charged',
          tenantId: 'ten_demo_corp',
          subscriptionId: 'sub_demo_123',
        })
      );
    });
  });

  it('should trigger GST tax invoice file download when clicking download button', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('GST Invoice')).toBeInTheDocument();
    });

    const downloadBtn = screen.getByText('GST Invoice');
    fireEvent.click(downloadBtn);

    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(window.URL.revokeObjectURL).toHaveBeenCalled();
  });
});
