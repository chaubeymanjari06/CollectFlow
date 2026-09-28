import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PromotionsPage } from '../../pages/promotions/PromotionsPage';
import * as TenantContextModule from '../../contexts/TenantContext';
import { promotionService, DEFAULT_MSME_PROMO_TEMPLATES } from '../../services/promotionService';

describe('PromotionsPage Component (Phase 21 Promotions Hub)', () => {
  const mockTenant = {
    tenantId: 'ten_promo_test',
    name: 'Shree Balaji Enterprises',
    currency: 'INR',
  };

  const mockClients = [
    {
      clientId: 'pclient_1',
      tenantId: 'ten_promo_test',
      companyName: 'Krishna Textiles',
      contactPerson: 'Mukesh Bhai',
      mobile: '+919876543210',
      city: 'Surat',
      tags: ['WHOLESALE'],
      source: 'MANUAL',
      preferences: { preferredChannel: 'WHATSAPP', preferredLanguage: 'en', promotionsOptOut: false, whatsappDeliverable: true },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const mockCampaigns = [
    {
      campaignId: 'cmp_1',
      tenantId: 'ten_promo_test',
      name: 'Diwali 2026 Volume Blast',
      templateId: 'preset_festive_volume_scheme',
      channel: 'WHATSAPP',
      targeting: { mode: 'ALL_CLIENTS' },
      dispatchConfig: { totalTargetAudience: 120, estimatedMetaCostInr: 96, batchSizePerMinute: 20, isScheduled: false },
      status: 'COMPLETED',
      metrics: { totalQueued: 120, sentCount: 120, deliveredCount: 114, readCount: 92, failedCount: 0, bouncedCount: 0, inquiriesReceived: 14, optOutsReceived: 0 },
      createdBy: 'user_1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const mockInquiries = [
    {
      inquiryId: 'inq_1',
      tenantId: 'ten_promo_test',
      campaignId: 'cmp_1',
      clientId: 'pclient_1',
      clientName: 'Krishna Textiles',
      clientMobile: '+919876543210',
      messagePreview: 'Please send latest wholesale rate list for festive lot',
      inboundChannel: 'WHATSAPP',
      status: 'NEW_LEAD',
      receivedAt: Date.now(),
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
      activeTenant: mockTenant as any,
      activeMembership: null,
      availableTenants: [],
      loadingTenants: false,
      role: 'OWNER',
      isOwner: true,
      isAdmin: true,
      isManager: true,
      isExecutive: true,
      isPartner: false,
      isViewer: false,
      switchTenant: vi.fn(),
      createCompany: vi.fn(),
      refreshTenantData: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
    });

    vi.spyOn(promotionService, 'getClients').mockResolvedValue(mockClients as any);
    vi.spyOn(promotionService, 'getTemplates').mockResolvedValue(DEFAULT_MSME_PROMO_TEMPLATES as any);
    vi.spyOn(promotionService, 'getCampaigns').mockResolvedValue(mockCampaigns as any);
    vi.spyOn(promotionService, 'getInquiries').mockResolvedValue(mockInquiries as any);
  });

  it('should render header, Meta quality indicator, and overview KPI cards', async () => {
    render(
      <MemoryRouter>
        <PromotionsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Promotions & Growth Hub')).toBeInTheDocument();
    expect(screen.getByText(/Meta WhatsApp Quality:/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Total B2B Audience')).toBeInTheDocument();
      expect(screen.getByText('WhatsApp Read Rate')).toBeInTheDocument();
      expect(screen.getByText('Inbound Leads')).toBeInTheDocument();
      expect(screen.getByText('Overdue Recovered')).toBeInTheDocument();
    });

    expect(screen.getByText('Diwali 2026 Volume Blast')).toBeInTheDocument();
  });

  it('should switch to Client Directory tab and show clients and action buttons', async () => {
    render(
      <MemoryRouter>
        <PromotionsPage />
      </MemoryRouter>
    );

    const clientTab = screen.getByRole('button', { name: /Client Directory & CSV/i });
    fireEvent.click(clientTab);

    await waitFor(() => {
      expect(screen.getByText('Sync from Tally')).toBeInTheDocument();
      expect(screen.getByText('Import CSV / Excel')).toBeInTheDocument();
      expect(screen.getByText('Add Contact')).toBeInTheDocument();
      expect(screen.getByText('Krishna Textiles')).toBeInTheDocument();
    });
  });

  it('should switch to Template Studio and display phone simulator preview', async () => {
    render(
      <MemoryRouter>
        <PromotionsPage />
      </MemoryRouter>
    );

    const tplTab = screen.getByRole('button', { name: /Template Studio/i });
    fireEvent.click(tplTab);

    await waitFor(() => {
      expect(screen.getByText(/Pre-Built MSME Promotional Schemes/i)).toBeInTheDocument();
      expect(screen.getByText('Official Business Account')).toBeInTheDocument();
    });
  });

  it('should switch to Campaign Wizard tab and show pre-flight budget and test broadcast options', async () => {
    render(
      <MemoryRouter>
        <PromotionsPage />
      </MemoryRouter>
    );

    const wizardTab = screen.getByRole('button', { name: /Campaign Wizard/i });
    fireEvent.click(wizardTab);

    expect(screen.getByText('Campaign Dispatch Wizard')).toBeInTheDocument();
    expect(screen.getByText(/Audience & Credit Risk Guardrail/i)).toBeInTheDocument();
    expect(screen.getByText(/Pre-Flight Budget & Safety Window/i)).toBeInTheDocument();
    expect(screen.getByText(/Sethji Pre-Send Test/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Test to My Phone/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm & Launch Campaign/i })).toBeInTheDocument();
  });

  it('should switch to Inbound Leads tab and display WhatsApp inquiry tickets', async () => {
    render(
      <MemoryRouter>
        <PromotionsPage />
      </MemoryRouter>
    );

    const inqTab = screen.getByRole('button', { name: /Inbound Leads/i });
    fireEvent.click(inqTab);

    await waitFor(() => {
      expect(screen.getByText('Inbound Promotional Inquiries (Leads)')).toBeInTheDocument();
      expect(screen.getByText('Krishna Textiles')).toBeInTheDocument();
      expect(screen.getByText(/Please send latest wholesale rate list/i)).toBeInTheDocument();
    });
  });
});
