import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateAging, generateUpiPaymentLink, receivablesService } from '../../services/receivablesService';
import { dbService } from '../../services/dbService';

describe('Receivables Engine (Phase 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateAging', () => {
    const fixedToday = new Date('2026-10-01');

    it('should mark invoice as PAID when balance is 0', () => {
      const res = calculateAging('2026-09-15', 0, 50000, fixedToday);
      expect(res.status).toBe('PAID');
      expect(res.daysPastDue).toBe(0);
      expect(res.agingBucket).toBe('CURRENT');
    });

    it('should mark invoice as DUE_TODAY if due date is today', () => {
      const res = calculateAging('2026-10-01', 25000, 0, fixedToday);
      expect(res.status).toBe('DUE_TODAY');
      expect(res.daysPastDue).toBe(0);
      expect(res.agingBucket).toBe('CURRENT');
    });

    it('should mark invoice as DUE_SOON if due in 3 days or less', () => {
      const res = calculateAging('2026-10-03', 25000, 0, fixedToday);
      expect(res.status).toBe('DUE_SOON');
      expect(res.daysPastDue).toBe(0);
      expect(res.agingBucket).toBe('CURRENT');
    });

    it('should correctly categorize 1–30 days overdue', () => {
      const res = calculateAging('2026-09-16', 40000, 0, fixedToday); // 15 days past due
      expect(res.status).toBe('OVERDUE');
      expect(res.daysPastDue).toBe(15);
      expect(res.agingBucket).toBe('1-30');
    });

    it('should correctly categorize 31–60 days overdue', () => {
      const res = calculateAging('2026-08-15', 40000, 0, fixedToday); // 47 days past due
      expect(res.status).toBe('OVERDUE');
      expect(res.daysPastDue).toBe(47);
      expect(res.agingBucket).toBe('31-60');
    });

    it('should correctly categorize 61–90 days overdue', () => {
      const res = calculateAging('2026-07-15', 40000, 0, fixedToday); // 78 days past due
      expect(res.status).toBe('OVERDUE');
      expect(res.daysPastDue).toBe(78);
      expect(res.agingBucket).toBe('61-90');
    });

    it('should correctly categorize 90+ days overdue', () => {
      const res = calculateAging('2026-06-01', 40000, 0, fixedToday); // 122 days past due
      expect(res.status).toBe('OVERDUE');
      expect(res.daysPastDue).toBe(122);
      expect(res.agingBucket).toBe('90+');
    });

    it('should assign PARTIALLY_PAID status if paidAmount > 0 and balance > 0', () => {
      const res = calculateAging('2026-09-15', 20000, 10000, fixedToday);
      expect(res.status).toBe('PARTIALLY_PAID');
      expect(res.agingBucket).toBe('1-30');
    });
  });

  describe('generateUpiPaymentLink', () => {
    it('should generate standard NPCI compliant UPI deep link and QR URL', () => {
      const { upiIntent, upiQrUrl } = generateUpiPaymentLink({
        vpa: 'shree@hdfcbank',
        payeeName: 'Shree Enterprises',
        amount: 45000,
        invoiceNumber: 'INV-101',
      });

      expect(upiIntent).toContain('upi://pay?');
      expect(upiIntent).toContain('pa=shree%40hdfcbank');
      expect(upiIntent).toContain('pn=Shree+Enterprises');
      expect(upiIntent).toContain('am=45000.00');
      expect(upiIntent).toContain('cu=INR');
      expect(upiIntent).toContain('tn=Invoice+INV-101');
      expect(upiQrUrl).toContain('https://api.qrserver.com');
    });
  });

  describe('recalculateTenantReceivables', () => {
    it('should aggregate tenant invoices into aging buckets and update dashboard', async () => {
      const mockInvoices = {
        inv_1: {
          invoiceId: 'inv_1',
          tenantId: 'ten_1',
          customerId: 'cust_1',
          customerName: 'Customer A',
          invoiceNumber: 'INV-1',
          invoiceDate: '2026-08-01',
          dueDate: '2026-08-30', // Overdue
          amount: 50000,
          paidAmount: 0,
          balance: 50000,
          status: 'OVERDUE',
          agingBucket: '1-30',
          daysPastDue: 25,
        },
        inv_2: {
          invoiceId: 'inv_2',
          tenantId: 'ten_1',
          customerId: 'cust_2',
          customerName: 'Customer B',
          invoiceNumber: 'INV-2',
          invoiceDate: '2026-09-15',
          dueDate: '2026-10-15', // Current
          amount: 30000,
          paidAmount: 0,
          balance: 30000,
          status: 'OPEN',
          agingBucket: 'CURRENT',
          daysPastDue: 0,
        },
      };

      const mockCustomers = {
        cust_1: { customerId: 'cust_1', name: 'Customer A', metrics: {} },
        cust_2: { customerId: 'cust_2', name: 'Customer B', metrics: {} },
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'invoices/ten_1') return mockInvoices as any;
        if (path === 'customers/ten_1') return mockCustomers as any;
        return null;
      });

      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const metrics = await receivablesService.recalculateTenantReceivables('ten_1');

      expect(metrics.totalReceivables).toBe(80000);
      expect(metrics.openInvoicesCount).toBe(2);
      expect(setSpy).toHaveBeenCalledWith('dashboard/ten_1', expect.objectContaining({
        totalReceivables: 80000,
        openInvoicesCount: 2,
      }));
    });
  });
});
