import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promotionService } from '../../services/promotionService';
import { dbService } from '../../services/dbService';

describe('Promotions & Growth Hub Service (promotionService)', () => {
  const tenantId = 'ten_test_101';
  let mockDb: Record<string, any> = {};

  beforeEach(() => {
    vi.restoreAllMocks();
    mockDb = {};

    vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
      if (mockDb[path] !== undefined) return mockDb[path];
      const prefix = path.endsWith('/') ? path : `${path}/`;
      const matching: Record<string, any> = {};
      let found = false;
      for (const [k, v] of Object.entries(mockDb)) {
        if (k.startsWith(prefix)) {
          const rest = k.slice(prefix.length);
          const subKey = rest.split('/')[0];
          matching[subKey] = v;
          found = true;
        }
      }
      return found ? matching : null;
    });

    vi.spyOn(dbService, 'set').mockImplementation(async (path: string, val: any) => {
      mockDb[path] = val;
    });

    vi.spyOn(dbService, 'update').mockImplementation(async (path: string, val: any) => {
      mockDb[path] = { ...(mockDb[path] || {}), ...val };
    });

    vi.spyOn(dbService, 'remove').mockImplementation(async (path: string) => {
      delete mockDb[path];
      const prefix = path.endsWith('/') ? path : `${path}/`;
      for (const k of Object.keys(mockDb)) {
        if (k.startsWith(prefix)) {
          delete mockDb[k];
        }
      }
    });
  });

  describe('Client Directory & Ingest', () => {
    it('should create client with sanitized Indian mobile (+91) and defaults', async () => {
      const client = await promotionService.createClient(tenantId, {
        companyName: 'Shree Balaji Textiles',
        contactPerson: 'Ramesh Bhai',
        mobile: '9876543210',
        city: 'Surat',
        tags: ['WHOLESALE'],
        source: 'MANUAL',
      });

      expect(client.clientId).toBeTruthy();
      expect(client.mobile).toBe('+919876543210');
      expect(client.tags).toContain('WHOLESALE');
      expect(client.preferences?.promotionsOptOut).toBe(false);
      expect(mockDb[`promotionClients/${tenantId}/${client.clientId}`]).toBeTruthy();
    });

    it('should bulk import contacts from CSV data and normalize numbers', async () => {
      const rawCsvList = [
        { companyName: 'Royal Hardware', contactPerson: 'Mukesh Seth', mobile: '9825012345', city: 'Rajkot', tags: ['VIP'] },
        { companyName: 'Om Ceramics', contactPerson: 'Jayesh Bhai', mobile: '+919924056789', city: 'Morbi', tags: ['DEALER'] },
      ];

      const res = await promotionService.bulkImportClients(tenantId, rawCsvList);
      expect(res.importedCount).toBe(2);
      expect(res.clients[0].mobile).toBe('+919825012345');
      expect(res.clients[1].mobile).toBe('+919924056789');
    });

    it('should 1-click sync client contacts directly from existing Tally customer ledgers', async () => {
      mockDb[`customers/${tenantId}`] = {
        cust_1: {
          customerId: 'cust_1',
          tenantId,
          name: 'Shree Krishna Traders',
          phone: '9811122233',
          email: 'krishna@trade.in',
          totalOutstanding: 150000,
          overdueAmount: 50000,
          oldestInvoiceDays: 42,
          whatsappOptOut: false,
        },
        cust_2: {
          customerId: 'cust_2',
          tenantId,
          name: 'Defaulter Corp',
          phone: '9844455566',
          totalOutstanding: 350000,
          overdueAmount: 350000,
          oldestInvoiceDays: 120, // >90 days -> credit frozen
          whatsappOptOut: false,
        },
      };

      const res = await promotionService.syncClientsFromCustomers(tenantId);
      expect(res.syncedCount).toBe(2);

      const krishna = res.clients.find((c) => c.companyName === 'Shree Krishna Traders');
      expect(krishna).toBeTruthy();
      expect(krishna?.mobile).toBe('+919811122233');
      expect(krishna?.financialSnapshot?.isCreditFrozen).toBe(false);

      const defaulter = res.clients.find((c) => c.companyName === 'Defaulter Corp');
      expect(defaulter?.financialSnapshot?.isCreditFrozen).toBe(true);
    });

    it('should update and delete client records', async () => {
      const client = await promotionService.createClient(tenantId, {
        companyName: 'Apex Tools',
        contactPerson: 'Anil Kumar',
        mobile: '9870001122',
        tags: ['RETAIL'],
        source: 'MANUAL',
      });

      const updated = await promotionService.updateClient(tenantId, client.clientId, { city: 'Ahmedabad' });
      expect(updated?.city).toBe('Ahmedabad');

      const deleted = await promotionService.deleteClient(tenantId, client.clientId);
      expect(deleted).toBe(true);
      expect(mockDb[`promotionClients/${tenantId}/${client.clientId}`]).toBeUndefined();
    });
  });

  describe('Template Studio', () => {
    it('should provide pre-built MSME promotional templates including Festive Scheme and Early Cash Discount', async () => {
      const templates = await promotionService.getTemplates(tenantId);
      expect(templates.length).toBeGreaterThanOrEqual(5);

      const festive = templates.find((t) => t.category === 'FESTIVE_SCHEME');
      expect(festive).toBeTruthy();
      expect(festive?.whatsapp.buttons?.length).toBeGreaterThan(0);
      expect(festive?.whatsapp.footerText).toContain('Reply STOP to unsubscribe');

      const earlyCd = templates.find((t) => t.category === 'EARLY_PAYMENT_DISCOUNT');
      expect(earlyCd).toBeTruthy();
    });

    it('should create and store custom promotional template', async () => {
      const customTpl = await promotionService.createTemplate(tenantId, {
        title: 'Custom Monsoon Clearance Scheme',
        category: 'CLEARANCE_SALE',
        channel: 'WHATSAPP',
        language: 'en',
        isSystemPreset: false,
        whatsapp: {
          metaTemplateName: 'monsoon_clearance_custom',
          metaTemplateStatus: 'APPROVED',
          headerType: 'TEXT',
          bodyText: 'Special Monsoon offer: {{1}} at {{2}}',
          footerText: 'Reply STOP to unsubscribe',
        },
      });

      expect(customTpl.templateId).toBeTruthy();
      expect(customTpl.title).toBe('Custom Monsoon Clearance Scheme');
    });
  });

  describe('Campaign Execution & Credit Risk Guardrails', () => {
    it('should create campaign with pre-flight Meta conversation budget estimation', async () => {
      const campaign = await promotionService.createCampaign(tenantId, {
        name: 'Diwali 2026 Volume Blast',
        templateId: 'preset_festive_volume_scheme',
        channel: 'WHATSAPP',
        targeting: {
          mode: 'ALL_CLIENTS',
          excludeFrozenCredit: true,
        },
        dispatchConfig: {
          totalTargetAudience: 100,
          estimatedMetaCostInr: 80,
          batchSizePerMinute: 20,
          isScheduled: false,
        },
        createdBy: 'user_1',
      });

      expect(campaign.campaignId).toBeTruthy();
      expect(campaign.status).toBe('DRAFT');
      expect(campaign.dispatchConfig.estimatedMetaCostInr).toBe(80);
    });

    it('should handle "Sethji Preview" single test broadcast to owner mobile', async () => {
      const campaign = await promotionService.createCampaign(tenantId, {
        name: 'Preview Campaign',
        templateId: 'preset_festive_volume_scheme',
        channel: 'WHATSAPP',
        targeting: { mode: 'ALL_CLIENTS' },
        dispatchConfig: { totalTargetAudience: 10, estimatedMetaCostInr: 8, batchSizePerMinute: 20, isScheduled: false },
        createdBy: 'user_1',
      });

      const res = await promotionService.dispatchCampaign(tenantId, campaign.campaignId, '9825099999');
      expect(res.success).toBe(true);
      expect(res.dispatchedCount).toBe(1);
      expect(res.message).toContain('+919825099999');
    });

    it('should filter out frozen-credit defaulters and opted-out contacts on full campaign dispatch', async () => {
      // Setup 3 clients in RTDB: 1 valid, 1 opted out, 1 credit frozen
      const c1 = await promotionService.createClient(tenantId, {
        companyName: 'Good Buyer Ltd',
        contactPerson: 'Kishore Bhai',
        mobile: '9811111111',
        tags: ['WHOLESALE'],
        source: 'MANUAL',
      });

      const c2 = await promotionService.createClient(tenantId, {
        companyName: 'Opted Out Client',
        contactPerson: 'Suresh Bhai',
        mobile: '9822222222',
        tags: ['WHOLESALE'],
        source: 'MANUAL',
      });
      await promotionService.updateClient(tenantId, c2.clientId, {
        preferences: { preferredChannel: 'WHATSAPP', preferredLanguage: 'en', promotionsOptOut: true, whatsappDeliverable: true },
      });

      const c3 = await promotionService.createClient(tenantId, {
        companyName: 'Defaulting Client',
        contactPerson: 'Dinesh Seth',
        mobile: '9833333333',
        tags: ['WHOLESALE'],
        source: 'MANUAL',
      });
      await promotionService.updateClient(tenantId, c3.clientId, {
        financialSnapshot: { currentOutstanding: 200000, overdueAmount: 200000, oldestBillAgeDays: 110, creditLimit: 50000, isCreditFrozen: true },
      });

      const campaign = await promotionService.createCampaign(tenantId, {
        name: 'Credit-Safe Festive Scheme',
        templateId: 'preset_festive_volume_scheme',
        channel: 'WHATSAPP',
        targeting: { mode: 'ALL_CLIENTS', excludeFrozenCredit: true },
        dispatchConfig: { totalTargetAudience: 3, estimatedMetaCostInr: 3, batchSizePerMinute: 20, isScheduled: false },
        createdBy: 'user_1',
      });

      const res = await promotionService.dispatchCampaign(tenantId, campaign.campaignId);
      // Only Good Buyer Ltd should be dispatched (c2 is opted out, c3 is credit frozen)
      expect(res.success).toBe(true);
      expect(res.dispatchedCount).toBe(1);

      const logs = await promotionService.getCampaignLogs(tenantId, campaign.campaignId);
      expect(logs.length).toBe(1);
      expect(logs[0].recipientMobile).toBe('+919811111111');
    });
  });

  describe('DPDP STOP Opt-Out & Inbound CRM Leads', () => {
    it('should mark client as promotionsOptOut when STOP webhook is triggered', async () => {
      const client = await promotionService.createClient(tenantId, {
        companyName: 'Privacy Conscious Co',
        contactPerson: 'Rajiv Bhai',
        mobile: '9899988877',
        tags: ['RETAIL'],
        source: 'MANUAL',
      });

      const handled = await promotionService.handleStopOptOut(tenantId, '9899988877');
      expect(handled).toBe(true);

      const updated = await dbService.get<any>(`promotionClients/${tenantId}/${client.clientId}`);
      expect(updated.preferences.promotionsOptOut).toBe(true);
      expect(updated.preferences.optOutReason).toContain('STOP');
    });

    it('should capture inbound inquiry and update sales lead status', async () => {
      const inq = await promotionService.createInquiry(tenantId, {
        campaignId: 'cmp_1',
        clientId: 'pclient_1',
        clientName: 'Shree Balaji Textiles',
        clientMobile: '+919876543210',
        messagePreview: 'Interested in booking 500 meters under festive discount. Please send invoice.',
        inboundChannel: 'WHATSAPP',
        status: 'NEW_LEAD',
      });

      expect(inq.inquiryId).toBeTruthy();

      const updated = await promotionService.updateInquiryStatus(tenantId, inq.inquiryId, 'ORDER_PLACED', 'Booking confirmed for ₹85,000');
      expect(updated?.status).toBe('ORDER_PLACED');
      expect(updated?.notes).toContain('85,000');
    });
  });
});
