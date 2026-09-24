import { describe, it, expect, vi, beforeEach } from 'vitest';
import { customer360Service } from '../../services/customer360Service';
import { dbService } from '../../services/dbService';

describe('Customer 360 & Financial Ledger Service (Phase 10)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCustomer360', () => {
    it('should compile complete 360 financial profile, risk tier, and chronological running ledger', async () => {
      const mockCustomer = {
        customerId: 'cust_360',
        tenantId: 'ten_1',
        name: 'Saraswati Industrial Works',
        mobile: '+919876543210',
        email: 'accounts@saraswati.com',
        creditLimit: 300000,
        paymentTerms: 30,
        optOutWhatsApp: false,
        status: 'ACTIVE',
      };

      const mockInvoices = {
        inv_1: {
          invoiceId: 'inv_1',
          tenantId: 'ten_1',
          customerId: 'cust_360',
          invoiceNumber: 'INV-01',
          invoiceDate: '2026-08-01',
          dueDate: '2026-08-31',
          amount: 150000,
          paidAmount: 150000,
          balance: 0,
          status: 'PAID',
          daysPastDue: 0,
        },
        inv_2: {
          invoiceId: 'inv_2',
          tenantId: 'ten_1',
          customerId: 'cust_360',
          invoiceNumber: 'INV-02',
          invoiceDate: '2026-09-01',
          dueDate: '2026-09-15',
          amount: 200000,
          paidAmount: 50000,
          balance: 150000,
          status: 'OVERDUE',
          daysPastDue: 10,
        },
      };

      const mockPayments = {
        pay_1: {
          paymentId: 'pay_1',
          tenantId: 'ten_1',
          customerId: 'cust_360',
          amount: 150000,
          paymentDate: '2026-08-25T10:00:00Z',
          provider: 'bank',
          utr: 'UTR881122',
          reconciliationStatus: 'FULLY_MATCHED',
        },
      };

      const mockPromises = {
        ptp_1: {
          promiseId: 'ptp_1',
          tenantId: 'ten_1',
          customerId: 'cust_360',
          invoiceIds: ['inv_2'],
          amount: 150000,
          promisedDate: '2026-09-30',
          status: 'PENDING',
        },
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'customers/ten_1/cust_360') return mockCustomer;
        if (path === 'invoices/ten_1') return mockInvoices;
        if (path === 'payments/ten_1') return mockPayments;
        if (path === 'promises/ten_1') return mockPromises;
        if (path === 'messages/ten_1') return {};
        if (path === 'reconciliations/ten_1') return {};
        return null;
      });

      const profile = await customer360Service.getCustomer360('ten_1', 'cust_360');

      expect(profile).not.toBeNull();
      expect(profile?.customer.name).toBe('Saraswati Industrial Works');
      expect(profile?.metrics.totalBilled).toBe(350000);
      expect(profile?.metrics.totalPaid).toBe(150000);
      expect(profile?.metrics.outstandingBalance).toBe(150000);
      expect(profile?.metrics.overdueBalance).toBe(150000);
      expect(profile?.metrics.creditLimit).toBe(300000);
      expect(profile?.metrics.creditUtilizationPct).toBe(50);

      // Verifies chronological ledger statement entries and running balance:
      // Event 1: 2026-08-01 Invoice +150,000 -> Running = 150,000
      // Event 2: 2026-08-25 Payment -150,000 -> Running = 0
      // Event 3: 2026-09-01 Invoice +200,000 -> Running = 200,000
      expect(profile?.ledgerEntries.length).toBe(3);
      expect(profile?.ledgerEntries[0].runningBalance).toBe(150000);
      expect(profile?.ledgerEntries[1].runningBalance).toBe(0);
      expect(profile?.ledgerEntries[2].runningBalance).toBe(200000);
    });

    it('should assign CRITICAL risk tier when overdue balance exceeds credit limit', async () => {
      const mockCustomer = {
        customerId: 'cust_risky',
        tenantId: 'ten_1',
        name: 'Risky Enterprise',
        creditLimit: 100000,
        paymentTerms: 15,
      };

      const mockInvoices = {
        inv_high: {
          invoiceId: 'inv_high',
          tenantId: 'ten_1',
          customerId: 'cust_risky',
          invoiceNumber: 'INV-HIGH',
          invoiceDate: '2026-08-01',
          dueDate: '2026-08-16',
          amount: 250000,
          balance: 250000,
          status: 'OVERDUE',
        },
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'customers/ten_1/cust_risky') return mockCustomer;
        if (path === 'invoices/ten_1') return mockInvoices;
        if (path === 'payments/ten_1') return {};
        if (path === 'promises/ten_1') return {};
        if (path === 'messages/ten_1') return {};
        if (path === 'reconciliations/ten_1') return {};
        return null;
      });

      const profile = await customer360Service.getCustomer360('ten_1', 'cust_risky');
      expect(profile?.metrics.riskTier).toBe('CRITICAL');
    });
  });

  describe('updateCustomerCreditTerms', () => {
    it('should update creditLimit and paymentTerms', async () => {
      const mockCustomer = {
        customerId: 'cust_edit',
        tenantId: 'ten_1',
        creditLimit: 200000,
        paymentTerms: 30,
        optOutWhatsApp: false,
      };

      vi.spyOn(dbService, 'get').mockResolvedValue(mockCustomer);
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const updated = await customer360Service.updateCustomerCreditTerms(
        'ten_1',
        'cust_edit',
        {
          creditLimit: 500000,
          paymentTerms: 45,
          optOutWhatsApp: true,
        }
      );

      expect(updated?.creditLimit).toBe(500000);
      expect(updated?.paymentTerms).toBe(45);
      expect(updated?.optOutWhatsApp).toBe(true);

      expect(updateSpy).toHaveBeenCalledWith('customers/ten_1/cust_edit', {
        creditLimit: 500000,
        paymentTerms: 45,
        optOutWhatsApp: true,
        updatedAt: expect.any(Number),
      });
    });
  });
});
