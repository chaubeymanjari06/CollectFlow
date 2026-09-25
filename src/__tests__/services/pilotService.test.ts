import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pilotService } from '../../services/pilotService';
import { dbService } from '../../services/dbService';

describe('pilotService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbService, 'update').mockResolvedValue(undefined);
  });

  it('should return all 3 industrial clusters with correct MSME targets', async () => {
    const clusters = await pilotService.getClusters();
    expect(clusters.length).toBe(3);

    const surat = clusters.find((c) => c.id === 'cluster-surat-textiles');
    expect(surat).toBeDefined();
    expect(surat?.name).toBe('Surat Textile Hub');
    expect(surat?.location).toBe('Surat, Gujarat');
    expect(surat?.merchantCount).toBeGreaterThanOrEqual(15);

    const ludhiana = clusters.find((c) => c.id === 'cluster-ludhiana-auto');
    expect(ludhiana).toBeDefined();
    expect(ludhiana?.name).toBe('Ludhiana Auto Component Cluster');

    const peenya = clusters.find((c) => c.id === 'cluster-peenya-machinery');
    expect(peenya).toBeDefined();
    expect(peenya?.name).toBe('Peenya Industrial Machinery Hub');
  });

  it('should return pilot merchants and allow filtering by cluster and stage', async () => {
    const allMerchants = await pilotService.getMerchants();
    expect(allMerchants.length).toBeGreaterThanOrEqual(7);

    // Filter by cluster
    const suratMerchants = await pilotService.getMerchants('cluster-surat-textiles');
    expect(suratMerchants.length).toBeGreaterThan(0);
    expect(suratMerchants.every((m) => m.clusterId === 'cluster-surat-textiles')).toBe(true);

    // Filter by stage
    const controlledMerchants = await pilotService.getMerchants(undefined, 'controlled_10_account');
    expect(controlledMerchants.every((m) => m.stage === 'controlled_10_account')).toBe(true);
  });

  it('should return merchant by id or null if missing', async () => {
    const merchant = await pilotService.getMerchantById('merch-surat-01');
    expect(merchant).toBeDefined();
    expect(merchant?.businessName).toBe('Vardhaman Synthetics LLP');

    const missing = await pilotService.getMerchantById('non-existent-id');
    expect(missing).toBeNull();
  });

  it('should compute pilot KPIs meeting Phase 18 targets', async () => {
    const kpis = await pilotService.getPilotKPIs();

    // MSME businesses target: 25-50
    expect(kpis.activeBusinesses).toBeGreaterThanOrEqual(kpis.targetBusinessesMin);
    expect(kpis.activeBusinesses).toBeLessThanOrEqual(kpis.targetBusinessesMax);

    // CA/Tally partners target: 5-10
    expect(kpis.activePartners).toBeGreaterThanOrEqual(kpis.targetPartnersMin);
    expect(kpis.activePartners).toBeLessThanOrEqual(kpis.targetPartnersMax);

    // Clusters: 1-3
    expect(kpis.activeClusters).toBe(3);

    // Tally Sync Reliability benchmark >= 98%
    expect(kpis.syncSuccessRateAvg).toBeGreaterThanOrEqual(98.0);
    expect(kpis.totalOutstandingTracked).toBeGreaterThan(0);
    expect(kpis.totalAmountCollected).toBeGreaterThan(0);
    expect(kpis.collectionRecoveryRate).toBeGreaterThan(0);
    expect(kpis.avgPtpSuccessRate).toBeGreaterThan(50.0);
  });

  it('should advance merchant stage and update progress appropriately', async () => {
    const merchant = await pilotService.advanceStage('merch-ludhiana-02', 'controlled_10_account');
    expect(merchant.stage).toBe('controlled_10_account');
    expect(merchant.stageProgress).toBe(65);
    expect(dbService.update).toHaveBeenCalledWith(
      expect.stringContaining('tenants/merch-ludhiana-02/pilot'),
      expect.objectContaining({ stage: 'controlled_10_account' })
    );
  });

  it('should toggle controlled 10-account safety throttle', async () => {
    const updated = await pilotService.toggleControlled10Pilot('merch-surat-01', false);
    expect(updated.controlled10PilotActive).toBe(false);

    const reEnabled = await pilotService.toggleControlled10Pilot('merch-surat-01', true);
    expect(reEnabled.controlled10PilotActive).toBe(true);
    expect(dbService.update).toHaveBeenCalled();
  });

  it('should simulate safe reminder dispatch to a controlled account', async () => {
    const merchant = await pilotService.getMerchantById('merch-surat-01');
    expect(merchant).toBeDefined();
    const accountId = merchant!.controlledAccounts[0].id;

    const account = await pilotService.simulateControlledReminder('merch-surat-01', accountId);
    expect(account.reminderStatus).toBe('DELIVERED');
    expect(account.safeTestMode).toBe(true);
    expect(account.lastContactAt).toContain('Simulated WhatsApp');
  });

  it('should evaluate 6-point graduation criteria and readiness', async () => {
    const grad = await pilotService.getGraduationCriteria('merch-surat-01');
    expect(grad.criteria.length).toBe(6);
    expect(grad.score).toBeGreaterThanOrEqual(80);
    expect(grad.eligible).toBe(true);

    const syncCriterion = grad.criteria.find((c) => c.id === 'crit-sync-uptime');
    expect(syncCriterion?.status).toBe('PASSED');
  });

  it('should graduate merchant to production and lift restrictions', async () => {
    const graduated = await pilotService.graduateMerchant('merch-peenya-01');
    expect(graduated.stage).toBe('graduated');
    expect(graduated.stageProgress).toBe(100);
    expect(graduated.controlled10PilotActive).toBe(false);
    expect(graduated.graduationScore).toBe(100);
    expect(graduated.graduatedAt).toBeDefined();
    expect(dbService.update).toHaveBeenCalled();
  });

  it('should return 30-day velocity trajectory measurements', async () => {
    const trajectory = await pilotService.getDailyMeasurements();
    expect(trajectory.length).toBe(30);
    expect(trajectory[0].day).toBe(1);
    expect(trajectory[29].day).toBe(30);
    expect(trajectory[29].amountCollected).toBeGreaterThan(trajectory[0].amountCollected);
  });

  it('should manage support tickets lifecycle with SLAs', async () => {
    const tickets = await pilotService.getSupportTickets();
    expect(tickets.length).toBeGreaterThanOrEqual(3);

    const newTicket = await pilotService.createSupportTicket({
      merchantId: 'merch-surat-01',
      merchantName: 'Vardhaman Synthetics LLP',
      cluster: 'Surat Textile Hub',
      title: 'Debtor requested PDF invoice on WhatsApp',
      category: 'WHATSAPP_DELIVERY',
      severity: 'LOW',
    });
    expect(newTicket.ticketId).toMatch(/^PILOT-TCK-/);
    expect(newTicket.status).toBe('OPEN');
    expect(newTicket.slaRemainingHours).toBe(24);

    const resolved = await pilotService.resolveSupportTicket(newTicket.ticketId);
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.slaRemainingHours).toBe(0);
  });
});
