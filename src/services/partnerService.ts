import { dbService } from './dbService';
import { tenantService } from './tenantService';
import {
  PartnerProfile,
  PartnerType,
  PartnerClientOnboarding,
  PartnerClientSummary,
  PartnerPortfolioOverview,
  PartnerSupportTicket,
  PartnerPayout,
  ClientHealthIndex,
  OnboardingStage,
  TicketCategory,
  TicketPriority,
  Tenant,
  DashboardMetrics,
  Device,
} from '../types';

export const partnerService = {
  // =========================================================================
  // 1. PARTNER REGISTRATION & PROFILE
  // =========================================================================

  async getPartnerProfile(partnerIdOrUserId: string): Promise<PartnerProfile | null> {
    if (!partnerIdOrUserId) return null;

    // Check by partnerId first
    let profile = await dbService.get<PartnerProfile>(`partners/${partnerIdOrUserId}`);
    if (profile) return profile;

    // Check by userId mapping
    const partnerId = await dbService.get<string>(`partnerUsers/${partnerIdOrUserId}`);
    if (partnerId) {
      profile = await dbService.get<PartnerProfile>(`partners/${partnerId}`);
      if (profile) return profile;
    }

    return null;
  },

  async registerPartner(params: {
    userId: string;
    firmName: string;
    partnerType: PartnerType;
    membershipNumber?: string;
    contactPerson: string;
    email: string;
    mobile: string;
    city: string;
    payoutUpiOrBank?: string;
  }): Promise<PartnerProfile> {
    if (!params.firmName?.trim()) {
      throw new Error('Firm/Practice name is required');
    }
    if (!params.email?.trim() || !params.mobile?.trim()) {
      throw new Error('Email and mobile number are required');
    }

    const now = Date.now();
    const partnerId = `prt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

    // Generate readable referral code e.g. CA-VERMA-2026
    const prefix = params.partnerType === 'CA' ? 'CA' : params.partnerType === 'TALLY_PARTNER' ? 'TP' : 'CF';
    const cleanFirm = params.firmName.split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6) || 'PARTNER';
    const referralCode = `${prefix}-${cleanFirm}-${new Date().getFullYear()}`;

    const profile: PartnerProfile = {
      partnerId,
      userId: params.userId,
      firmName: params.firmName.trim(),
      partnerType: params.partnerType,
      membershipNumber: params.membershipNumber?.trim() || undefined,
      contactPerson: params.contactPerson.trim(),
      email: params.email.trim(),
      mobile: params.mobile.trim(),
      city: params.city.trim() || 'Mumbai',
      referralCode,
      commissionRatePct: 20, // 20% recurring monthly revenue share
      tier: 'SILVER',
      status: 'ACTIVE',
      payoutUpiOrBank: params.payoutUpiOrBank?.trim() || `${params.mobile}@upi`,
      createdAt: now,
      updatedAt: now,
    };

    await dbService.set(`partners/${partnerId}`, profile);
    await dbService.set(`partnerUsers/${params.userId}`, partnerId);

    // Seed initial demo data for new partner so dashboard is immediately rich
    await this.seedPartnerDemoData(partnerId);

    return profile;
  },

  async updatePartnerProfile(
    partnerId: string,
    updates: Partial<PartnerProfile>
  ): Promise<PartnerProfile> {
    const current = await this.getPartnerProfile(partnerId);
    if (!current) throw new Error('Partner profile not found');

    const updated: PartnerProfile = {
      ...current,
      ...updates,
      updatedAt: Date.now(),
    };

    await dbService.set(`partners/${partnerId}`, updated);
    return updated;
  },

  // =========================================================================
  // 2. CLIENT INVITATION & ONBOARDING PIPELINE
  // =========================================================================

  async inviteClient(
    partnerId: string,
    params: {
      clientName: string;
      contactPerson: string;
      email: string;
      mobile: string;
      gstin?: string;
      city: string;
      expectedMonthlyVolume?: number;
      notes?: string;
    }
  ): Promise<PartnerClientOnboarding> {
    if (!params.clientName?.trim()) {
      throw new Error('Client business name is required');
    }
    if (!params.mobile?.trim()) {
      throw new Error('Client mobile number is required');
    }

    const now = Date.now();
    const invitationId = `invt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const token = `tok_${Math.random().toString(36).substring(2, 12)}`;

    const onboarding: PartnerClientOnboarding = {
      invitationId,
      partnerId,
      clientName: params.clientName.trim(),
      contactPerson: params.contactPerson.trim(),
      email: params.email.trim(),
      mobile: params.mobile.trim(),
      gstin: params.gstin?.trim() || undefined,
      city: params.city.trim() || 'Mumbai',
      expectedMonthlyVolume: params.expectedMonthlyVolume || 1000000,
      stage: 'INVITE_SENT',
      token,
      invitedAt: now,
      notes: params.notes?.trim() || undefined,
    };

    await dbService.set(`partnerInvitations/${partnerId}/${invitationId}`, onboarding);
    return onboarding;
  },

  async getPartnerInvitations(partnerId: string): Promise<PartnerClientOnboarding[]> {
    const data = await dbService.get<Record<string, PartnerClientOnboarding>>(
      `partnerInvitations/${partnerId}`
    );
    if (!data) return [];
    return Object.values(data).sort((a, b) => b.invitedAt - a.invitedAt);
  },

  async updateInvitationStage(
    partnerId: string,
    invitationId: string,
    stage: OnboardingStage,
    tenantId?: string
  ): Promise<PartnerClientOnboarding> {
    const existing = await dbService.get<PartnerClientOnboarding>(
      `partnerInvitations/${partnerId}/${invitationId}`
    );
    if (!existing) throw new Error('Invitation record not found');

    const updated: PartnerClientOnboarding = {
      ...existing,
      stage,
      tenantId: tenantId || existing.tenantId,
      connectedAt: stage === 'LIVE' || stage === 'TALLY_CONNECTED' ? Date.now() : existing.connectedAt,
    };

    await dbService.set(`partnerInvitations/${partnerId}/${invitationId}`, updated);
    return updated;
  },

  async fastTrackOnboardClient(
    partnerId: string,
    invitationId: string
  ): Promise<{ onboarding: PartnerClientOnboarding; summary: PartnerClientSummary }> {
    const invitation = await dbService.get<PartnerClientOnboarding>(
      `partnerInvitations/${partnerId}/${invitationId}`
    );
    if (!invitation) throw new Error('Invitation not found');

    const now = Date.now();
    const tenantId = `ten_partner_${invitation.clientName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;

    // Provision new client tenant
    const newTenant: Tenant = {
      tenantId,
      name: invitation.clientName,
      legalName: `${invitation.clientName} Pvt Ltd`,
      gstin: invitation.gstin || '27AAACB9988C1Z4',
      email: invitation.email,
      mobile: invitation.mobile,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      planId: 'growth_monthly',
      status: 'ACTIVE',
      tallyConnected: true,
      settings: {
        defaultPaymentTermsDays: 30,
        autoReconcileThreshold: 90,
        sendPreDueReminders: true,
        sendDueReminders: true,
        sendOverdueReminders: true,
        reminderChannel: 'WHATSAPP',
        upiVpa: `${invitation.clientName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@hdfcbank`,
        payeeName: invitation.clientName,
      },
      createdAt: now,
      updatedAt: now,
    };

    await dbService.set(`tenants/${tenantId}`, newTenant);

    // Link client to partner
    await dbService.set(`partnerClients/${partnerId}/${tenantId}`, {
      partnerId,
      tenantId,
      clientName: invitation.clientName,
      city: invitation.city,
      monthlyBillingPlan: 'Growth Plan (₹2,999/mo)',
      partnerMonthlyCommission: 600, // 20% of 2999 ~ ₹600/mo
      addedAt: now,
    });

    // Advance invitation stage to LIVE
    const updatedOnboarding = await this.updateInvitationStage(
      partnerId,
      invitationId,
      'LIVE',
      tenantId
    );

    // Initial metrics
    const health = this.calculateClientHealth({
      totalReceivables: 1250000,
      overdueAmount: 220000,
      dso: 28,
      tallyConnected: true,
      agentStatus: 'ONLINE',
    });

    const summary: PartnerClientSummary = {
      tenantId,
      clientName: invitation.clientName,
      legalName: newTenant.legalName,
      gstin: newTenant.gstin,
      city: invitation.city,
      tallyConnected: true,
      agentStatus: 'ONLINE',
      lastSyncTime: now,
      totalReceivables: 1250000,
      overdueAmount: 220000,
      overdueRatioPct: 17.6,
      dso: 28,
      activeInvoicesCount: 14,
      health,
      monthlyBillingPlan: 'Growth Plan (₹2,999/mo)',
      partnerMonthlyCommission: 600,
    };

    return { onboarding: updatedOnboarding, summary };
  },

  // =========================================================================
  // 3. MULTI-CLIENT PORTFOLIO & HEALTH DIAGNOSTICS
  // =========================================================================

  calculateClientHealth(params: {
    totalReceivables: number;
    overdueAmount: number;
    dso: number;
    tallyConnected: boolean;
    agentStatus: string;
  }): ClientHealthIndex {
    let score = 100;
    const reasons: string[] = [];

    const overdueRatio = params.totalReceivables > 0 ? (params.overdueAmount / params.totalReceivables) * 100 : 0;

    // Overdue ratio penalties
    if (overdueRatio > 50) {
      score -= 35;
      reasons.push(`High Overdue Ratio: ${overdueRatio.toFixed(1)}% of receivables past maturity`);
    } else if (overdueRatio > 30) {
      score -= 20;
      reasons.push(`Moderate Overdue: ${overdueRatio.toFixed(1)}% of bills overdue`);
    } else if (overdueRatio > 15) {
      score -= 10;
      reasons.push(`Minor Overdue: ${overdueRatio.toFixed(1)}% past due date`);
    }

    // DSO penalties
    if (params.dso > 60) {
      score -= 25;
      reasons.push(`Extended DSO: ${params.dso} days collection cycle (industry norm: 35-45)`);
    } else if (params.dso > 45) {
      score -= 15;
      reasons.push(`Elevated DSO: ${params.dso} days collection cycle`);
    }

    // Connectivity penalties
    if (!params.tallyConnected || params.agentStatus === 'OFFLINE' || params.agentStatus === 'NOT_PAIRED') {
      score -= 20;
      reasons.push('Tally Desktop Agent is offline or not syncing');
    }

    score = Math.max(10, Math.min(100, Math.round(score)));

    let tier: 'EXCELLENT' | 'HEALTHY' | 'NEEDS_ATTENTION' | 'CRITICAL' = 'EXCELLENT';
    let recommendedAction = 'Maintain current remindercadence; working capital velocity is optimal.';

    if (score < 50) {
      tier = 'CRITICAL';
      recommendedAction = 'Immediate intervention required: restart Tally agent and escalate critical debtors via formal legal WhatsApp notices.';
    } else if (score < 70) {
      tier = 'NEEDS_ATTENTION';
      recommendedAction = 'Activate pre-due WhatsApp reminder workflows and review customers exceeding credit limits.';
    } else if (score < 85) {
      tier = 'HEALTHY';
      recommendedAction = 'Stable operations; follow up on broken PTPs to prevent aging into 60+ days bucket.';
    }

    return {
      score,
      tier,
      reasons: reasons.length > 0 ? reasons : ['All receivables metrics and Tally sync health are in pristine standing'],
      recommendedAction,
    };
  },

  async getPartnerPortfolio(partnerId: string): Promise<PartnerPortfolioOverview> {
    const clientsMap = (await dbService.get<Record<string, any>>(`partnerClients/${partnerId}`)) || {};
    const clientEntries = Object.values(clientsMap);

    const invitations = await this.getPartnerInvitations(partnerId);
    const onboardingClients = invitations.filter((i) => i.stage !== 'LIVE').length;

    // If no client records exist, load seeded sample clients for this partner
    let clients: PartnerClientSummary[] = [];

    if (clientEntries.length === 0) {
      clients = await this.getSeededPartnerClients(partnerId);
    } else {
      for (const entry of clientEntries) {
        const tenant = await dbService.get<Tenant>(`tenants/${entry.tenantId}`);
        const metrics = await dbService.get<DashboardMetrics>(`dashboard/${entry.tenantId}`);
        const devices = (await dbService.get<Record<string, Device>>(`devices/${entry.tenantId}`)) || {};
        const activeDevice = Object.values(devices)[0];

        const totalReceivables = metrics?.totalReceivables || 1500000;
        const overdueAmount = metrics?.overdueAmount || 350000;
        const overdueRatioPct = totalReceivables > 0 ? (overdueAmount / totalReceivables) * 100 : 0;
        const dso = metrics?.dso || 36;
        const agentStatus = activeDevice?.status === 'ONLINE' ? 'ONLINE' : tenant?.tallyConnected ? 'ONLINE' : 'OFFLINE';

        const health = this.calculateClientHealth({
          totalReceivables,
          overdueAmount,
          dso,
          tallyConnected: !!tenant?.tallyConnected,
          agentStatus,
        });

        clients.push({
          tenantId: entry.tenantId,
          clientName: entry.clientName || tenant?.name || 'MSME Client',
          legalName: tenant?.legalName || undefined,
          gstin: tenant?.gstin || null,
          city: entry.city || 'Mumbai',
          tallyConnected: !!tenant?.tallyConnected,
          agentStatus,
          lastSyncTime: activeDevice?.lastSyncTime || tenant?.updatedAt || Date.now(),
          totalReceivables,
          overdueAmount,
          overdueRatioPct: Math.round(overdueRatioPct * 10) / 10,
          dso,
          activeInvoicesCount: metrics?.openInvoicesCount || 12,
          health,
          monthlyBillingPlan: entry.monthlyBillingPlan || 'Growth Plan (₹2,999/mo)',
          partnerMonthlyCommission: entry.partnerMonthlyCommission || 600,
        });
      }
    }

    const totalReceivablesUnderManagement = clients.reduce((sum, c) => sum + c.totalReceivables, 0);
    const totalOverdueUnderManagement = clients.reduce((sum, c) => sum + c.overdueAmount, 0);
    const averagePortfolioDso = clients.length > 0 ? Math.round(clients.reduce((sum, c) => sum + c.dso, 0) / clients.length) : 0;
    const totalCommissionEarned = clients.reduce((sum, c) => sum + c.partnerMonthlyCommission, 0) * 6; // last 6 months
    const pendingPayoutAmount = clients.reduce((sum, c) => sum + c.partnerMonthlyCommission, 0); // current month

    return {
      totalClients: clients.length,
      activeClients: clients.filter((c) => c.health.tier !== 'CRITICAL').length,
      onboardingClients,
      totalReceivablesUnderManagement,
      totalOverdueUnderManagement,
      averagePortfolioDso,
      totalCommissionEarned,
      pendingPayoutAmount,
      clients,
    };
  },

  async getSeededPartnerClients(partnerId: string): Promise<PartnerClientSummary[]> {
    const now = Date.now();

    const sampleClients: PartnerClientSummary[] = [
      {
        tenantId: 'ten_demo_corp',
        clientName: 'Apex Steel & Industrial Supplies Pvt Ltd',
        legalName: 'Apex Steel & Industrial Supplies Pvt Ltd',
        gstin: '27AAACA1234A1Z5',
        city: 'Mumbai',
        tallyConnected: true,
        agentStatus: 'ONLINE',
        lastSyncTime: now - 1800000,
        totalReceivables: 1900000,
        overdueAmount: 1360000,
        overdueRatioPct: 71.6,
        dso: 38,
        activeInvoicesCount: 9,
        health: this.calculateClientHealth({
          totalReceivables: 1900000,
          overdueAmount: 1360000,
          dso: 38,
          tallyConnected: true,
          agentStatus: 'ONLINE',
        }),
        monthlyBillingPlan: 'Enterprise Plan (₹4,999/mo)',
        partnerMonthlyCommission: 1000,
      },
      {
        tenantId: 'ten_shree_cement',
        clientName: 'Shree Cement & Building Materials',
        legalName: 'Shree Cement Distributors LLP',
        gstin: '27AAACS4321B1Z2',
        city: 'Pune',
        tallyConnected: true,
        agentStatus: 'ONLINE',
        lastSyncTime: now - 3600000,
        totalReceivables: 2450000,
        overdueAmount: 480000,
        overdueRatioPct: 19.6,
        dso: 32,
        activeInvoicesCount: 22,
        health: this.calculateClientHealth({
          totalReceivables: 2450000,
          overdueAmount: 480000,
          dso: 32,
          tallyConnected: true,
          agentStatus: 'ONLINE',
        }),
        monthlyBillingPlan: 'Growth Plan (₹2,999/mo)',
        partnerMonthlyCommission: 600,
      },
      {
        tenantId: 'ten_kalyan_works',
        clientName: 'Kalyan Industrial Works',
        legalName: 'Kalyan Precision Engineering Pvt Ltd',
        gstin: '27AAACK8877P1Z9',
        city: 'Thane',
        tallyConnected: true,
        agentStatus: 'ONLINE',
        lastSyncTime: now - 7200000,
        totalReceivables: 1820000,
        overdueAmount: 150000,
        overdueRatioPct: 8.2,
        dso: 25,
        activeInvoicesCount: 16,
        health: this.calculateClientHealth({
          totalReceivables: 1820000,
          overdueAmount: 150000,
          dso: 25,
          tallyConnected: true,
          agentStatus: 'ONLINE',
        }),
        monthlyBillingPlan: 'Growth Plan (₹2,999/mo)',
        partnerMonthlyCommission: 600,
      },
      {
        tenantId: 'ten_delhi_hardware',
        clientName: 'Delhi Metro Hardware Traders',
        legalName: 'Delhi Hardware & Electricals Co',
        gstin: '07AAACD5566A1Z3',
        city: 'Delhi',
        tallyConnected: false,
        agentStatus: 'OFFLINE',
        lastSyncTime: now - 432000000, // 5 days ago
        totalReceivables: 3100000,
        overdueAmount: 1850000,
        overdueRatioPct: 59.7,
        dso: 58,
        activeInvoicesCount: 28,
        health: this.calculateClientHealth({
          totalReceivables: 3100000,
          overdueAmount: 1850000,
          dso: 58,
          tallyConnected: false,
          agentStatus: 'OFFLINE',
        }),
        monthlyBillingPlan: 'Growth Plan (₹2,999/mo)',
        partnerMonthlyCommission: 600,
      },
    ];

    // Persist seeded clients for future loads
    for (const c of sampleClients) {
      await dbService.set(`partnerClients/${partnerId}/${c.tenantId}`, {
        partnerId,
        tenantId: c.tenantId,
        clientName: c.clientName,
        city: c.city,
        monthlyBillingPlan: c.monthlyBillingPlan,
        partnerMonthlyCommission: c.partnerMonthlyCommission,
        addedAt: now,
      });
    }

    return sampleClients;
  },

  // =========================================================================
  // 4. PARTNER SUPPORT TICKETS
  // =========================================================================

  async getSupportTickets(partnerId: string): Promise<PartnerSupportTicket[]> {
    const data = await dbService.get<Record<string, PartnerSupportTicket>>(
      `partnerTickets/${partnerId}`
    );
    if (!data) return [];
    return Object.values(data).sort((a, b) => b.createdAt - a.createdAt);
  },

  async createSupportTicket(params: {
    partnerId: string;
    partnerName: string;
    clientTenantId?: string;
    clientName?: string;
    title: string;
    category: TicketCategory;
    priority: TicketPriority;
    description: string;
  }): Promise<PartnerSupportTicket> {
    if (!params.title?.trim() || !params.description?.trim()) {
      throw new Error('Ticket title and description are required');
    }

    const now = Date.now();
    const ticketId = `tkt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    const ticket: PartnerSupportTicket = {
      ticketId,
      partnerId: params.partnerId,
      partnerName: params.partnerName,
      clientTenantId: params.clientTenantId,
      clientName: params.clientName,
      title: params.title.trim(),
      category: params.category,
      priority: params.priority,
      status: 'OPEN',
      description: params.description.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await dbService.set(`partnerTickets/${params.partnerId}/${ticketId}`, ticket);
    return ticket;
  },

  async resolveSupportTicket(
    partnerId: string,
    ticketId: string,
    resolution: string
  ): Promise<PartnerSupportTicket> {
    const existing = await dbService.get<PartnerSupportTicket>(
      `partnerTickets/${partnerId}/${ticketId}`
    );
    if (!existing) throw new Error('Ticket not found');

    const updated: PartnerSupportTicket = {
      ...existing,
      status: 'RESOLVED',
      resolution: resolution.trim(),
      updatedAt: Date.now(),
    };

    await dbService.set(`partnerTickets/${partnerId}/${ticketId}`, updated);
    return updated;
  },

  // =========================================================================
  // 5. REVENUE & PAYOUTS
  // =========================================================================

  async getPartnerPayouts(partnerId: string): Promise<PartnerPayout[]> {
    const data = await dbService.get<Record<string, PartnerPayout>>(`partnerPayouts/${partnerId}`);
    if (data) return Object.values(data).sort((a, b) => b.month.localeCompare(a.month));

    // Default seeded payouts
    const initialPayouts: PartnerPayout[] = [
      {
        payoutId: 'payo_2026_08',
        partnerId,
        month: 'August 2026',
        amount: 2800,
        clientCount: 4,
        status: 'PAID',
        utr: 'HDFC-NEFT-88339911',
        payoutDate: '2026-09-05',
        destination: 'HDFC Bank A/c **4102',
      },
      {
        payoutId: 'payo_2026_07',
        partnerId,
        month: 'July 2026',
        amount: 2200,
        clientCount: 3,
        status: 'PAID',
        utr: 'HDFC-NEFT-77228800',
        payoutDate: '2026-08-05',
        destination: 'HDFC Bank A/c **4102',
      },
      {
        payoutId: 'payo_2026_09',
        partnerId,
        month: 'September 2026',
        amount: 2800,
        clientCount: 4,
        status: 'UPCOMING',
        destination: 'HDFC Bank A/c **4102',
      },
    ];

    for (const p of initialPayouts) {
      await dbService.set(`partnerPayouts/${partnerId}/${p.payoutId}`, p);
    }

    return initialPayouts;
  },

  // =========================================================================
  // 6. SEED DEMO DATA HELPER
  // =========================================================================

  async seedPartnerDemoData(partnerId: string): Promise<void> {
    const now = Date.now();

    // 1. Initial invitations
    const sampleInvites: PartnerClientOnboarding[] = [
      {
        invitationId: 'invt_demo_01',
        partnerId,
        clientName: 'Western Valves & Castings Ltd',
        contactPerson: 'Sanjay Joshi',
        email: 'accounts@westernvalves.com',
        mobile: '+919820556677',
        city: 'Kolhapur',
        expectedMonthlyVolume: 3500000,
        stage: 'TALLY_CONNECTED',
        token: 'tok_demo_wvalves',
        invitedAt: now - 3 * 86400000,
        notes: 'Windows agent installed on Tally Server; waiting for first full ledger sync.',
      },
      {
        invitationId: 'invt_demo_02',
        partnerId,
        clientName: 'Shree Balaji Textile Processing',
        contactPerson: 'Mukesh Somani',
        email: 'billing@balajitex.com',
        mobile: '+919821334455',
        city: 'Surat',
        expectedMonthlyVolume: 5000000,
        stage: 'INVITE_SENT',
        token: 'tok_demo_balaji',
        invitedAt: now - 1 * 86400000,
        notes: 'Followed up via WhatsApp; demo scheduled for Saturday.',
      },
    ];

    for (const inv of sampleInvites) {
      await dbService.set(`partnerInvitations/${partnerId}/${inv.invitationId}`, inv);
    }

    // 2. Initial support tickets
    const sampleTickets: PartnerSupportTicket[] = [
      {
        ticketId: 'tkt_demo_01',
        partnerId,
        partnerName: 'Verma & Associates CA',
        clientTenantId: 'ten_delhi_hardware',
        clientName: 'Delhi Metro Hardware Traders',
        title: 'Tally ODBC Port 9000 Connection Timed Out',
        category: 'TALLY_SYNC',
        priority: 'HIGH',
        status: 'OPEN',
        description: 'Client upgraded to TallyPrime 4.1. The CollectFlow Windows Agent is reporting connection refused on localhost:9000.',
        createdAt: now - 12 * 3600000,
        updatedAt: now - 12 * 3600000,
      },
      {
        ticketId: 'tkt_demo_02',
        partnerId,
        partnerName: 'Verma & Associates CA',
        clientTenantId: 'ten_demo_corp',
        clientName: 'Apex Steel & Industrial Supplies Pvt Ltd',
        title: 'WhatsApp Reminder Sequence Verification for 90+ Days Bucket',
        category: 'INTEGRATIONS',
        priority: 'MEDIUM',
        status: 'RESOLVED',
        description: 'Requesting confirmation whether the legal final notice WhatsApp template is approved by Meta for delivery.',
        resolution: 'Verified with Meta Cloud API. Template CF_LEGAL_OVERDUE_01 is active and sending successfully.',
        createdAt: now - 48 * 3600000,
        updatedAt: now - 24 * 3600000,
      },
    ];

    for (const t of sampleTickets) {
      await dbService.set(`partnerTickets/${partnerId}/${t.ticketId}`, t);
    }

    // 3. Initial clients
    await this.getSeededPartnerClients(partnerId);
    // 4. Initial payouts
    await this.getPartnerPayouts(partnerId);
  },
};
