import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CopilotPage } from '../../pages/copilot/CopilotPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import { dbService } from '../../services/dbService';
import { aiCopilotService } from '../../services/aiCopilotService';

describe('CopilotPage Component (Phase 12)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      activeTenant: {
        tenantId: 'ten_demo',
        name: 'Apex Steel & Industrial Supplies Pvt Ltd',
        currency: 'INR',
      } as any,
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

    vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
      if (path === 'customers/ten_demo') {
        return {
          cust_1: {
            customerId: 'cust_1',
            tenantId: 'ten_demo',
            name: 'Premier Infrastructure Ltd',
            mobile: '+919876500001',
            contactPerson: 'Suresh Patel',
            riskTier: 'HIGH',
            creditLimit: 500000,
            metrics: {
              outstandingBalance: 350000,
              overdueBalance: 200000,
            },
          },
        };
      }
      if (path === 'invoices/ten_demo') {
        return {
          inv_1: {
            invoiceId: 'inv_1',
            customerId: 'cust_1',
            invoiceNumber: 'INV-2026-001',
            balance: 200000,
            dueDate: '2026-08-15',
          },
        };
      }
      return null;
    });

    vi.spyOn(aiCopilotService, 'diagnoseCustomerAccount').mockResolvedValue({
      customerId: 'cust_1',
      customerName: 'Premier Infrastructure Ltd',
      executiveSummary: 'Premier Infrastructure Ltd owes INR 3,50,000 with critical overdue balance.',
      rootCauses: ['Credit limit exceeded by 40%', 'Past due by 42 days'],
      riskAssessment: {
        riskTier: 'HIGH',
        defaultProbability: 'HIGH',
        creditUtilizationPct: 140,
        overdueDays: 42,
      },
      recommendedStrategy: [
        'Enforce credit hold on new dispatches',
        'Executive phone escalation with counterpart finance head',
      ],
    });

    vi.spyOn(aiCopilotService, 'draftSmartCollectionMessage').mockResolvedValue({
      recipientName: 'Premier Infrastructure Ltd',
      recipientMobile: '+919876500001',
      channel: 'WHATSAPP',
      tone: 'firm',
      content: 'Dear Suresh Patel,\n\nPlease settle outstanding invoice INV-2026-001.',
      suggestedUpiLink: 'upi://pay?pa=apex@icici&am=200000',
      invoicesReferenced: ['INV-2026-001'],
      totalAmount: 200000,
    });

    vi.spyOn(aiCopilotService, 'forecastCashFlow').mockResolvedValue({
      periodDays: 30,
      expectedInflow: 450000,
      conservativeInflow: 310000,
      optimisticInflow: 590000,
      ptpBackedInflow: 250000,
      dueInvoiceInflow: 200000,
      assumptions: ['PTP modeled at 85% realization'],
    });

    vi.spyOn(aiCopilotService, 'generateManagementSummary').mockResolvedValue({
      tenantName: 'Apex Steel & Industrial Supplies Pvt Ltd',
      generatedAt: Date.now(),
      totalReceivables: 1250000,
      overduePercentage: 35,
      dso: 44,
      criticalAccountsCount: 2,
      topOverdueAccounts: [
        {
          name: 'Premier Infrastructure Ltd',
          overdueAmount: 200000,
          daysOverdue: 42,
        },
      ],
      executiveNarrative: 'Portfolio shows stable collections with 35% overdue concentration.',
      suggestedActionItems: ['Follow up with top 2 overdue accounts'],
    });
  });

  it('should render AI Copilot header and default to Account Diagnostician view', async () => {
    render(
      <MemoryRouter>
        <CopilotPage />
      </MemoryRouter>
    );

    // Verify Copilot header
    expect(screen.getByText('Receivables AI Copilot')).toBeInTheDocument();
    expect(screen.getByText('Account Diagnostician')).toBeInTheDocument();

    // Verify diagnosis content is rendered after load
    await waitFor(() => {
      expect(
        screen.getByText(/AI Account Diagnosis: Premier Infrastructure Ltd/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/Credit limit exceeded by 40%/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Enforce credit hold on new dispatches/i)
    ).toBeInTheDocument();
  });

  it('should switch between Copilot tabs and display smart message drafter', async () => {
    render(
      <MemoryRouter>
        <CopilotPage />
      </MemoryRouter>
    );

    // Click on Smart Message Drafter tab
    const drafterTab = screen.getByText('Smart Message Drafter');
    fireEvent.click(drafterTab);

    await waitFor(() => {
      expect(
        screen.getByText('Smart WhatsApp Message Drafter')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Approve & Send to WhatsApp')).toBeInTheDocument();
  });

  it('should switch to PTP NLP parser and allow testing extraction presets', async () => {
    render(
      <MemoryRouter>
        <CopilotPage />
      </MemoryRouter>
    );

    const ptpTab = screen.getByText('PTP Response Parser (NLP)');
    fireEvent.click(ptpTab);

    await waitFor(() => {
      expect(
        screen.getByText('Customer Chat / Reply Transcript')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Register PTP & Pause Automated Reminders')).toBeInTheDocument();
  });

  it('should display Cash Flow Forecast and Management Briefing', async () => {
    render(
      <MemoryRouter>
        <CopilotPage />
      </MemoryRouter>
    );

    // Test Forecast tab
    const forecastTab = screen.getByText('Cash Flow Forecast');
    fireEvent.click(forecastTab);

    await waitFor(() => {
      expect(
        screen.getByText('Inflow & Cash Collection Forecast')
      ).toBeInTheDocument();
    });

    // Test Briefing tab
    const briefingTab = screen.getByText('Management Briefing');
    fireEvent.click(briefingTab);

    await waitFor(() => {
      expect(
        screen.getByText(/Portfolio shows stable collections with 35% overdue concentration./i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Copy Briefing')).toBeInTheDocument();
  });
});
