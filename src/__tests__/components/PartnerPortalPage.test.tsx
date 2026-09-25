import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PartnerPortalPage } from '../../pages/partner/PartnerPortalPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import * as AuthContextModule from '../../contexts/AuthContext';
import { partnerService } from '../../services/partnerService';

describe('PartnerPortalPage Component (Phase 14)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      currentUser: { uid: 'usr_ca_demo', email: 'partner@collectflow.demo' } as any,
      userProfile: { userId: 'usr_ca_demo', name: 'CA Neha Verma', email: 'partner@collectflow.demo' } as any,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      activeTenant: {
        tenantId: 'ten_demo_corp',
        name: 'Apex Steel & Industrial Supplies Pvt Ltd',
        currency: 'INR',
      } as any,
      activeMembership: null,
      availableTenants: [],
      loadingTenants: false,
      role: 'PARTNER',
      isOwner: false,
      isAdmin: false,
      isManager: false,
      isExecutive: false,
      isPartner: true,
      isViewer: false,
      switchTenant: vi.fn(),
      createCompany: vi.fn(),
      refreshTenantData: vi.fn().mockResolvedValue(undefined),
      hasPermission: vi.fn().mockReturnValue(true),
    });

    vi.spyOn(partnerService, 'getPartnerProfile').mockResolvedValue({
      partnerId: 'prt_demo_ca',
      userId: 'usr_ca_demo',
      firmName: 'Verma & Associates Chartered Accountants',
      partnerType: 'CA',
      membershipNumber: 'ICAI-MRN-402911',
      contactPerson: 'CA Neha Verma',
      email: 'partner@collectflow.demo',
      mobile: '+919820011221',
      city: 'Mumbai',
      referralCode: 'CA-VERMA-2026',
      commissionRatePct: 20,
      tier: 'SILVER',
      status: 'ACTIVE',
      payoutUpiOrBank: 'ca.neha@hdfcbank',
      createdAt: Date.now() - 30 * 86400000,
      updatedAt: Date.now(),
    });

    vi.spyOn(partnerService, 'getPartnerPortfolio').mockResolvedValue({
      totalClients: 4,
      activeClients: 3,
      onboardingClients: 1,
      totalReceivablesUnderManagement: 9270000,
      totalOverdueUnderManagement: 3840000,
      averagePortfolioDso: 38,
      totalCommissionEarned: 16800,
      pendingPayoutAmount: 2800,
      clients: [
        {
          tenantId: 'ten_demo_corp',
          clientName: 'Apex Steel & Industrial Supplies Pvt Ltd',
          city: 'Mumbai',
          gstin: '27AAACA1234A1Z5',
          tallyConnected: true,
          agentStatus: 'ONLINE',
          lastSyncTime: Date.now() - 1800000,
          totalReceivables: 1900000,
          overdueAmount: 1360000,
          overdueRatioPct: 71.6,
          dso: 38,
          activeInvoicesCount: 9,
          health: {
            score: 55,
            tier: 'NEEDS_ATTENTION',
            reasons: ['High Overdue Ratio: 71.6% of receivables past maturity'],
            recommendedAction: 'Activate pre-due WhatsApp reminder workflows and review customers exceeding credit limits.',
          },
          monthlyBillingPlan: 'Enterprise Plan (₹4,999/mo)',
          partnerMonthlyCommission: 1000,
        },
      ],
    });

    vi.spyOn(partnerService, 'getPartnerInvitations').mockResolvedValue([
      {
        invitationId: 'invt_1',
        partnerId: 'prt_demo_ca',
        clientName: 'Western Valves & Castings Ltd',
        contactPerson: 'Sanjay Joshi',
        email: 'accounts@westernvalves.com',
        mobile: '+919820556677',
        city: 'Kolhapur',
        expectedMonthlyVolume: 3500000,
        stage: 'TALLY_CONNECTED',
        token: 'tok_demo_wvalves',
        invitedAt: Date.now() - 86400000,
      },
    ]);

    vi.spyOn(partnerService, 'getSupportTickets').mockResolvedValue([
      {
        ticketId: 'tkt_01',
        partnerId: 'prt_demo_ca',
        partnerName: 'Verma & Associates CA',
        clientName: 'Delhi Metro Hardware Traders',
        title: 'Tally ODBC Port 9000 Connection Timed Out',
        category: 'TALLY_SYNC',
        priority: 'HIGH',
        status: 'OPEN',
        description: 'Client upgraded to TallyPrime 4.1.',
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 3600000,
      },
    ]);

    vi.spyOn(partnerService, 'getPartnerPayouts').mockResolvedValue([
      {
        payoutId: 'payo_01',
        partnerId: 'prt_demo_ca',
        month: 'August 2026',
        amount: 2800,
        clientCount: 4,
        status: 'PAID',
        utr: 'HDFC-NEFT-88339911',
        destination: 'HDFC Bank A/c **4102',
      },
    ]);
  });

  it('should render partner firm name, referral code, and KPI metric cards', async () => {
    render(
      <MemoryRouter>
        <PartnerPortalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Verma & Associates Chartered Accountants')).toBeInTheDocument();
      expect(screen.getByText(/Code: CA-VERMA-2026/i)).toBeInTheDocument();
      expect(screen.getByText('CA Partner')).toBeInTheDocument();
    });

    expect(screen.getByText('Managed Clients')).toBeInTheDocument();
    expect(screen.getByText('Total Receivables')).toBeInTheDocument();
    expect(screen.getByText('Overdue Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Average DSO')).toBeInTheDocument();
    expect(screen.getByText('Monthly Revenue Share')).toBeInTheDocument();
  });

  it('should display client portfolio table with health tier badges and diagnostics button', async () => {
    render(
      <MemoryRouter>
        <PartnerPortalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Apex Steel & Industrial Supplies Pvt Ltd')).toBeInTheDocument();
      expect(screen.getByText('Live Agent')).toBeInTheDocument();
      expect(screen.getByText('NEEDS ATTENTION (55)')).toBeInTheDocument();
    });

    // Click Diagnostics
    fireEvent.click(screen.getByText('Diagnostics'));

    // Should open diagnostics modal
    await waitFor(() => {
      expect(screen.getByText('Partner Financial Health & Risk Assessment')).toBeInTheDocument();
      expect(screen.getByText('55 / 100')).toBeInTheDocument();
      expect(screen.getByText(/High Overdue Ratio: 71.6%/i)).toBeInTheDocument();
    });
  });

  it('should switch to Onboarding Pipeline tab and display invitations', async () => {
    render(
      <MemoryRouter>
        <PartnerPortalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Onboarding Pipeline/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Onboarding Pipeline/i));

    await waitFor(() => {
      expect(screen.getByText('Partner Assisted Onboarding Workflow')).toBeInTheDocument();
      expect(screen.getByText('Western Valves & Castings Ltd')).toBeInTheDocument();
      expect(screen.getByText('TALLY CONNECTED')).toBeInTheDocument();
    });
  });

  it('should switch to Commissions & Payouts tab and display disbursements', async () => {
    render(
      <MemoryRouter>
        <PartnerPortalPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText(/Commissions & Payouts/i));

    await waitFor(() => {
      expect(screen.getByText('Partner Commission & Payout Schedule')).toBeInTheDocument();
      expect(screen.getByText('August 2026')).toBeInTheDocument();
      expect(screen.getByText('HDFC-NEFT-88339911')).toBeInTheDocument();
    });
  });

  it('should switch to Support Tickets tab and display open tickets', async () => {
    render(
      <MemoryRouter>
        <PartnerPortalPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText(/Support Tickets/i));

    await waitFor(() => {
      expect(screen.getByText('Partner Advisory Helpdesk')).toBeInTheDocument();
      expect(screen.getByText('Tally ODBC Port 9000 Connection Timed Out')).toBeInTheDocument();
      expect(screen.getByText('OPEN')).toBeInTheDocument();
    });
  });

  it('should switch to Partner Reports & Audits tab and display cross-client debtors audit', async () => {
    render(
      <MemoryRouter>
        <PartnerPortalPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText(/Partner Reports & Audits/i));

    await waitFor(() => {
      expect(screen.getByText('Partner Compliance & Audit Summaries')).toBeInTheDocument();
      expect(screen.getByText('43B(h) Risk')).toBeInTheDocument();
    });
  });
});
