import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectionIntelligenceService } from '../../services/collectionIntelligenceService';
import { dbService } from '../../services/dbService';

describe('Collection Intelligence & Prioritization Engine (Phase 11)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCollectionIntelligence', () => {
    it('should compute DSO, collection efficiency, and rank accounts with transparent factors', async () => {
      const mockCustomers = {
        cust_urgent: {
          customerId: 'cust_urgent',
          tenantId: 'ten_1',
          name: 'Apex Infotech Ltd',
          mobile: '+919988776655',
          creditLimit: 100000,
        },
        cust_normal: {
          customerId: 'cust_normal',
          tenantId: 'ten_1',
          name: 'Calcutta Spices',
          mobile: '+919877665544',
          creditLimit: 500000,
        },
      };

      const now = Date.now();
      const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const mockInvoices = {
        inv_urgent: {
          invoiceId: 'inv_urgent',
          tenantId: 'ten_1',
          customerId: 'cust_urgent',
          invoiceNumber: 'INV-U1',
          amount: 150000,
          balance: 150000,
          dueDate: sixtyDaysAgo,
        },
        inv_normal: {
          invoiceId: 'inv_normal',
          tenantId: 'ten_1',
          customerId: 'cust_normal',
          invoiceNumber: 'INV-N1',
          amount: 50000,
          balance: 50000,
          dueDate: tenDaysAgo,
        },
      };

      const mockPayments = {
        pay_1: {
          paymentId: 'pay_1',
          tenantId: 'ten_1',
          amount: 100000,
        },
      };

      const mockPromises = {
        ptp_broken: {
          promiseId: 'ptp_broken',
          tenantId: 'ten_1',
          customerId: 'cust_urgent',
          status: 'BROKEN',
        },
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'customers/ten_1') return mockCustomers;
        if (path === 'invoices/ten_1') return mockInvoices;
        if (path === 'payments/ten_1') return mockPayments;
        if (path === 'promises/ten_1') return mockPromises;
        return null;
      });

      const intelligence = await collectionIntelligenceService.getCollectionIntelligence('ten_1');

      expect(intelligence.totalReceivables).toBe(200000);
      expect(intelligence.totalOverdue).toBe(200000);
      expect(intelligence.collectionEfficiencyPct).toBeGreaterThan(0);

      // Verifies priority queue ranking: cust_urgent must be ranked #1
      expect(intelligence.priorityQueue.length).toBe(2);
      const topPriority = intelligence.priorityQueue[0];
      expect(topPriority.customerId).toBe('cust_urgent');
      expect(topPriority.urgency).toBe('CRITICAL');
      expect(topPriority.priorityScore).toBeGreaterThan(intelligence.priorityQueue[1].priorityScore);

      // Verifies transparent contributing factors breakdown
      expect(topPriority.contributingFactors.some((f) => f.includes('Overdue balance'))).toBe(true);
      expect(topPriority.contributingFactors.some((f) => f.includes('unfulfilled Promise-to-Pay'))).toBe(true);
      expect(topPriority.contributingFactors.some((f) => f.includes('credit limit'))).toBe(true);

      // Verifies actionable recommendation
      expect(topPriority.recommendedAction).toContain('Immediate phone escalation');
    });
  });
});
