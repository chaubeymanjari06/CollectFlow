import { describe, it, expect, vi, beforeEach } from 'vitest';
import { partnerService } from '../../services/partnerService';
import { dbService } from '../../services/dbService';

describe('Phase 14: Partner Service (CA & Tally Partner Portal)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. PARTNER REGISTRATION & PROFILE
  // =========================================================================
  describe('Partner Registration & Profile', () => {
    it('should register a new CA/Tally Partner practice and generate referral code', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      vi.spyOn(partnerService, 'seedPartnerDemoData').mockResolvedValue(undefined);

      const profile = await partnerService.registerPartner({
        userId: 'usr_ca_01',
        firmName: 'Verma & Associates Chartered Accountants',
        partnerType: 'CA',
        membershipNumber: 'ICAI-MRN-402911',
        contactPerson: 'CA Neha Verma',
        email: 'partner@collectflow.demo',
        mobile: '+919820011221',
        city: 'Mumbai',
        payoutUpiOrBank: 'ca.neha@hdfcbank',
      });

      expect(profile.partnerId).toMatch(/^prt_/);
      expect(profile.referralCode).toMatch(/^CA-VERMA-\d{4}$/);
      expect(profile.partnerType).toBe('CA');
      expect(profile.commissionRatePct).toBe(20);
      expect(profile.tier).toBe('SILVER');
      expect(profile.status).toBe('ACTIVE');

      expect(setSpy).toHaveBeenCalledWith(
        expect.stringContaining(`partners/${profile.partnerId}`),
        expect.objectContaining({ firmName: 'Verma & Associates Chartered Accountants' })
      );
      expect(setSpy).toHaveBeenCalledWith('partnerUsers/usr_ca_01', profile.partnerId);
    });

    it('should validate required firm name, email, and mobile', async () => {
      await expect(
        partnerService.registerPartner({
          userId: 'usr_1',
          firmName: '',
          partnerType: 'CA',
          contactPerson: 'CA Neha',
          email: 'ca@test.com',
          mobile: '9820011221',
          city: 'Mumbai',
        })
      ).rejects.toThrow('Firm/Practice name is required');

      await expect(
        partnerService.registerPartner({
          userId: 'usr_1',
          firmName: 'Test Firm',
          partnerType: 'CA',
          contactPerson: 'CA Neha',
          email: '',
          mobile: '9820011221',
          city: 'Mumbai',
        })
      ).rejects.toThrow('Email and mobile number are required');
    });

    it('should retrieve partner profile by partnerId or userId', async () => {
      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'partners/prt_100') {
          return {
            partnerId: 'prt_100',
            userId: 'usr_100',
            firmName: 'Apex Tally Systems',
            partnerType: 'TALLY_PARTNER',
          };
        }
        if (path === 'partnerUsers/usr_100') {
          return 'prt_100';
        }
        return null;
      });

      const byId = await partnerService.getPartnerProfile('prt_100');
      expect(byId?.firmName).toBe('Apex Tally Systems');

      const byUserId = await partnerService.getPartnerProfile('usr_100');
      expect(byUserId?.partnerId).toBe('prt_100');
    });
  });

  // =========================================================================
  // 2. CLIENT INVITATION & ONBOARDING PIPELINE
  // =========================================================================
  describe('Client Invitation & Onboarding Pipeline', () => {
    it('should create client invitation with unique token and initial INVITE_SENT stage', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const invitation = await partnerService.inviteClient('prt_100', {
        clientName: 'Mahindra Precision Gears',
        contactPerson: 'Vikram Joshi',
        email: 'billing@mahindragears.com',
        mobile: '+919820998877',
        gstin: '27AAACM9988C1Z2',
        city: 'Pune',
        expectedMonthlyVolume: 4000000,
        notes: 'High debtor aging; needs automated WhatsApp dunning',
      });

      expect(invitation.invitationId).toMatch(/^invt_/);
      expect(invitation.stage).toBe('INVITE_SENT');
      expect(invitation.token).toMatch(/^tok_/);
      expect(invitation.expectedMonthlyVolume).toBe(4000000);

      expect(setSpy).toHaveBeenCalledWith(
        expect.stringContaining('partnerInvitations/prt_100/invt_'),
        expect.objectContaining({ clientName: 'Mahindra Precision Gears' })
      );
    });

    it('should update invitation stage across the onboarding lifecycle', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue({
        invitationId: 'invt_1',
        partnerId: 'prt_100',
        clientName: 'Mahindra Precision Gears',
        stage: 'INVITE_SENT',
      });
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const updated = await partnerService.updateInvitationStage(
        'prt_100',
        'invt_1',
        'TALLY_CONNECTED',
        'ten_client_99'
      );

      expect(updated.stage).toBe('TALLY_CONNECTED');
      expect(updated.tenantId).toBe('ten_client_99');
      expect(updated.connectedAt).toBeDefined();
    });

    it('should fast-track onboard client, provision tenant, and link partner commission', async () => {
      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'partnerInvitations/prt_100/invt_fast') {
          return {
            invitationId: 'invt_fast',
            partnerId: 'prt_100',
            clientName: 'Godrej Tubes Division',
            contactPerson: 'Suresh Godrej',
            email: 'accounts@godrej.com',
            mobile: '+919820556677',
            city: 'Mumbai',
            stage: 'INVITE_SENT',
          };
        }
        return null;
      });

      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const res = await partnerService.fastTrackOnboardClient('prt_100', 'invt_fast');

      expect(res.onboarding.stage).toBe('LIVE');
      expect(res.summary.clientName).toBe('Godrej Tubes Division');
      expect(res.summary.partnerMonthlyCommission).toBe(600);
      expect(res.summary.health.tier).toBe('EXCELLENT');

      expect(setSpy).toHaveBeenCalledWith(
        expect.stringContaining('tenants/ten_partner_godrej_tubes_division'),
        expect.objectContaining({ name: 'Godrej Tubes Division', tallyConnected: true })
      );
    });
  });

  // =========================================================================
  // 3. CLIENT HEALTH & DIAGNOSTICS
  // =========================================================================
  describe('Client Health Diagnostics', () => {
    it('should assign EXCELLENT health score for prompt payer with live Tally agent', () => {
      const health = partnerService.calculateClientHealth({
        totalReceivables: 1000000,
        overdueAmount: 80000, // 8% overdue
        dso: 28,
        tallyConnected: true,
        agentStatus: 'ONLINE',
      });

      expect(health.score).toBeGreaterThanOrEqual(85);
      expect(health.tier).toBe('EXCELLENT');
      expect(health.reasons[0]).toContain('pristine standing');
    });

    it('should penalize high overdue ratio (>50%) and offline agent, assigning CRITICAL health', () => {
      const health = partnerService.calculateClientHealth({
        totalReceivables: 2000000,
        overdueAmount: 1400000, // 70% overdue
        dso: 65, // Extended DSO
        tallyConnected: false,
        agentStatus: 'OFFLINE',
      });

      expect(health.score).toBeLessThan(50);
      expect(health.tier).toBe('CRITICAL');
      expect(health.reasons.some((r) => r.includes('High Overdue Ratio'))).toBe(true);
      expect(health.reasons.some((r) => r.includes('Extended DSO'))).toBe(true);
      expect(health.reasons.some((r) => r.includes('offline'))).toBe(true);
      expect(health.recommendedAction).toContain('Immediate intervention required');
    });
  });

  // =========================================================================
  // 4. MULTI-CLIENT PORTFOLIO OVERVIEW
  // =========================================================================
  describe('Multi-Client Portfolio Overview', () => {
    it('should calculate portfolio aggregations across all managed clients', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);
      vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      vi.spyOn(partnerService, 'getPartnerInvitations').mockResolvedValue([
        { invitationId: 'inv_1', stage: 'INVITE_SENT' } as any,
      ]);

      const overview = await partnerService.getPartnerPortfolio('prt_demo');

      expect(overview.totalClients).toBe(4);
      expect(overview.onboardingClients).toBe(1);
      expect(overview.totalReceivablesUnderManagement).toBeGreaterThan(5000000);
      expect(overview.totalOverdueUnderManagement).toBeGreaterThan(1000000);
      expect(overview.averagePortfolioDso).toBeGreaterThan(20);
      expect(overview.pendingPayoutAmount).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 5. SUPPORT TICKETS & PAYOUTS
  // =========================================================================
  describe('Support Tickets & Payouts', () => {
    it('should create and resolve support tickets', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const ticket = await partnerService.createSupportTicket({
        partnerId: 'prt_100',
        partnerName: 'Verma & Associates CA',
        clientName: 'Apex Steel',
        title: 'Tally Port Conflict on Workstation 2',
        category: 'TALLY_SYNC',
        priority: 'HIGH',
        description: 'Tally XML server is rejecting requests with 503 Service Unavailable.',
      });

      expect(ticket.ticketId).toMatch(/^tkt_/);
      expect(ticket.status).toBe('OPEN');
      expect(ticket.priority).toBe('HIGH');

      vi.spyOn(dbService, 'get').mockResolvedValue(ticket);

      const resolved = await partnerService.resolveSupportTicket(
        'prt_100',
        ticket.ticketId,
        'Changed Tally ODBC port from 9000 to 9005 in tally.ini and re-paired agent.'
      );

      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.resolution).toContain('tally.ini');
    });

    it('should retrieve partner payout history with status and amounts', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);
      vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const payouts = await partnerService.getPartnerPayouts('prt_100');
      expect(payouts.length).toBeGreaterThanOrEqual(2);
      expect(payouts[0].amount).toBeGreaterThan(0);
      expect(payouts[0].destination).toContain('HDFC Bank');
    });
  });
});
