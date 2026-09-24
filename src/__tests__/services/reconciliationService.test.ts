import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconciliationService } from '../../services/reconciliationService';
import { dbService } from '../../services/dbService';
import { receivablesService } from '../../services/receivablesService';
import { paymentService } from '../../services/paymentService';
import { Payment } from '../../types';

describe('Confidence-Based Reconciliation & Tally Write-Back Engine (Phase 8 & 9)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('evaluatePaymentMatch hierarchy', () => {
    it('Rule 1: should return 100% confidence for EXACT_INVOICE_REF', async () => {
      const mockInvoices = {
        inv_1: {
          invoiceId: 'inv_1',
          tenantId: 'ten_1',
          customerId: 'cust_1',
          customerName: 'Kaveri Steel Corp',
          invoiceNumber: 'INV-2026-0042',
          amount: 50000,
          paidAmount: 0,
          balance: 50000,
        },
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'invoices/ten_1') return mockInvoices;
        if (path === 'customers/ten_1') return {};
        return null;
      });

      const payment: Payment = {
        paymentId: 'pay_1',
        tenantId: 'ten_1',
        amount: 50000,
        currency: 'INR',
        paymentDate: '2026-09-24',
        source: 'razorpay',
        provider: 'razorpay',
        status: 'SUCCESS',
        reconciliationStatus: 'UNMATCHED',
        matchedAmount: 0,
        unmatchedBalance: 50000,
        idempotencyKey: 'idem_1',
        rawReference: 'Payment received for INV-2026-0042 via Razorpay',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const match = await reconciliationService.evaluatePaymentMatch('ten_1', payment);

      expect(match).not.toBeNull();
      expect(match?.confidenceScore).toBe(100);
      expect(match?.matchRule).toBe('EXACT_INVOICE_REF');
      expect(match?.suggestedAllocations[0].invoiceId).toBe('inv_1');
      expect(match?.suggestedAllocations[0].allocatedAmount).toBe(50000);
    });

    it('Rule 2: should return 95% confidence for EXACT_AMOUNT_MATCH with known customer', async () => {
      const mockInvoices = {
        inv_1: {
          invoiceId: 'inv_1',
          tenantId: 'ten_1',
          customerId: 'cust_2',
          customerName: 'Mehta Distributors',
          invoiceNumber: 'INV-2026-0099',
          amount: 32500,
          paidAmount: 0,
          balance: 32500,
        },
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'invoices/ten_1') return mockInvoices;
        if (path === 'customers/ten_1') return {};
        return null;
      });

      const payment: Payment = {
        paymentId: 'pay_2',
        tenantId: 'ten_1',
        customerId: 'cust_2',
        customerName: 'Mehta Distributors',
        amount: 32500,
        currency: 'INR',
        paymentDate: '2026-09-24',
        source: 'manual',
        provider: 'bank',
        status: 'SUCCESS',
        reconciliationStatus: 'UNMATCHED',
        matchedAmount: 0,
        unmatchedBalance: 32500,
        idempotencyKey: 'idem_2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const match = await reconciliationService.evaluatePaymentMatch('ten_1', payment);

      expect(match).not.toBeNull();
      expect(match?.confidenceScore).toBe(95);
      expect(match?.matchRule).toBe('EXACT_AMOUNT_MATCH');
      expect(match?.suggestedAllocations[0].allocatedAmount).toBe(32500);
    });

    it('Rule 3: should return 85% confidence for UTR / active PTP match', async () => {
      const mockInvoices = {
        inv_3: {
          invoiceId: 'inv_3',
          tenantId: 'ten_1',
          customerId: 'cust_3',
          customerName: 'Apex Logistics',
          invoiceNumber: 'INV-2026-0150',
          amount: 100000,
          paidAmount: 0,
          balance: 100000,
        },
      };

      const mockPromises = {
        ptp_1: {
          promiseId: 'ptp_1',
          tenantId: 'ten_1',
          customerId: 'cust_3',
          invoiceIds: ['inv_3'],
          amount: 60000,
          status: 'PENDING',
        },
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'invoices/ten_1') return mockInvoices;
        if (path === 'customers/ten_1') return { cust_3: { name: 'Apex Logistics' } };
        if (path === 'promises/ten_1') return mockPromises;
        return null;
      });

      const payment: Payment = {
        paymentId: 'pay_3',
        tenantId: 'ten_1',
        customerId: 'cust_3',
        amount: 60000,
        currency: 'INR',
        paymentDate: '2026-09-24',
        source: 'manual',
        provider: 'bank',
        utr: 'HDFC998811',
        status: 'SUCCESS',
        reconciliationStatus: 'UNMATCHED',
        matchedAmount: 0,
        unmatchedBalance: 60000,
        idempotencyKey: 'idem_3',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const match = await reconciliationService.evaluatePaymentMatch('ten_1', payment);

      expect(match).not.toBeNull();
      expect(match?.confidenceScore).toBe(85);
      expect(match?.matchRule).toBe('UTR_MATCH');
      expect(match?.customerId).toBe('cust_3');
    });
  });

  describe('runAutoReconciliation', () => {
    it('should auto-reconcile >=95% matches, update invoice balances, and queue Tally write-back', async () => {
      const mockInvoices = {
        inv_1: {
          invoiceId: 'inv_1',
          tenantId: 'ten_1',
          customerId: 'cust_1',
          customerName: 'Kaveri Steel Corp',
          invoiceNumber: 'INV-2026-0042',
          amount: 40000,
          paidAmount: 0,
          balance: 40000,
        },
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'invoices/ten_1') return mockInvoices;
        if (path === 'customers/ten_1') return {};
        if (path === 'promises/ten_1') return {};
        return null;
      });

      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const recordInvSpy = vi
        .spyOn(receivablesService, 'recordPaymentOnInvoice')
        .mockResolvedValue(null);
      const updatePaySpy = vi
        .spyOn(paymentService, 'updatePaymentReconciliation')
        .mockResolvedValue(null);
      vi.spyOn(receivablesService, 'recalculateTenantReceivables').mockResolvedValue({} as any);

      const payment: Payment = {
        paymentId: 'pay_exact_1',
        tenantId: 'ten_1',
        amount: 40000,
        currency: 'INR',
        paymentDate: '2026-09-24',
        source: 'razorpay',
        provider: 'razorpay',
        status: 'SUCCESS',
        reconciliationStatus: 'UNMATCHED',
        matchedAmount: 0,
        unmatchedBalance: 40000,
        rawReference: 'Ref: INV-2026-0042',
        idempotencyKey: 'idem_exact_1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await reconciliationService.runAutoReconciliation('ten_1', payment);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('AUTO_RECONCILED');
      expect(result?.tallyWriteBackStatus).toBe('QUEUED');

      // Verifies invoice balance reduction called
      expect(recordInvSpy).toHaveBeenCalledWith('ten_1', 'inv_1', 40000);

      // Verifies payment status updated
      expect(updatePaySpy).toHaveBeenCalledWith('ten_1', 'pay_exact_1', 40000);

      // Verifies Tally command queued
      expect(setSpy).toHaveBeenCalledWith(
        expect.stringContaining('tallyVoucherCommands/ten_1/cmd_'),
        expect.objectContaining({
          voucherType: 'Receipt',
          amount: 40000,
          status: 'QUEUED',
        })
      );
    });

    it('should place 80-94% matches in PENDING_APPROVAL queue without committing balances', async () => {
      const mockInvoices = {
        inv_due: {
          invoiceId: 'inv_due',
          tenantId: 'ten_1',
          customerId: 'cust_fifo',
          customerName: 'FIFO Customer',
          invoiceNumber: 'INV-FIFO-01',
          amount: 100000,
          paidAmount: 0,
          balance: 100000,
          dueDate: '2026-08-01',
        },
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'invoices/ten_1') return mockInvoices;
        if (path === 'customers/ten_1') return {};
        if (path === 'promises/ten_1') return {};
        return null;
      });

      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const recordInvSpy = vi.spyOn(receivablesService, 'recordPaymentOnInvoice');

      const payment: Payment = {
        paymentId: 'pay_fifo_1',
        tenantId: 'ten_1',
        customerId: 'cust_fifo',
        amount: 25000,
        currency: 'INR',
        paymentDate: '2026-09-24',
        source: 'manual',
        provider: 'bank',
        status: 'SUCCESS',
        reconciliationStatus: 'UNMATCHED',
        matchedAmount: 0,
        unmatchedBalance: 25000,
        idempotencyKey: 'idem_fifo_1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = await reconciliationService.runAutoReconciliation('ten_1', payment);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('PENDING_APPROVAL');
      expect(result?.confidenceScore).toBe(80);
      expect(result?.tallyWriteBackStatus).toBe('NOT_REQUIRED');

      // Balances must NOT be committed until approval
      expect(recordInvSpy).not.toHaveBeenCalled();
    });
  });

  describe('approveReconciliation & rejectReconciliation', () => {
    it('should commit balances, mark approved, and queue Tally write-back on approval', async () => {
      const mockRec = {
        reconciliationId: 'rec_pending_1',
        tenantId: 'ten_1',
        paymentId: 'pay_1',
        customerId: 'cust_1',
        paymentAmount: 20000,
        totalAllocated: 20000,
        allocations: [
          {
            invoiceId: 'inv_10',
            invoiceNumber: 'INV-10',
            allocatedAmount: 20000,
            invoiceBalanceBefore: 20000,
            invoiceBalanceAfter: 0,
          },
        ],
        status: 'PENDING_APPROVAL',
        matchRule: 'UTR_MATCH',
        confidenceScore: 85,
        tallyWriteBackStatus: 'NOT_REQUIRED',
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'reconciliations/ten_1/rec_pending_1') return mockRec;
        if (path === 'promises/ten_1') return {};
        return null;
      });

      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);
      vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const recordInvSpy = vi
        .spyOn(receivablesService, 'recordPaymentOnInvoice')
        .mockResolvedValue(null);
      const updatePaySpy = vi
        .spyOn(paymentService, 'updatePaymentReconciliation')
        .mockResolvedValue(null);
      vi.spyOn(receivablesService, 'recalculateTenantReceivables').mockResolvedValue({} as any);

      const approved = await reconciliationService.approveReconciliation(
        'ten_1',
        'rec_pending_1',
        'user_accountant'
      );

      expect(approved.status).toBe('APPROVED');
      expect(approved.approvedBy).toBe('user_accountant');
      expect(recordInvSpy).toHaveBeenCalledWith('ten_1', 'inv_10', 20000);
      expect(updatePaySpy).toHaveBeenCalledWith('ten_1', 'pay_1', 20000);
      expect(updateSpy).toHaveBeenCalledWith(
        'reconciliations/ten_1/rec_pending_1',
        expect.objectContaining({
          status: 'APPROVED',
          tallyWriteBackStatus: 'QUEUED',
        })
      );
    });

    it('should reject reconciliation and update notes', async () => {
      const mockRec = {
        reconciliationId: 'rec_rej_1',
        tenantId: 'ten_1',
        status: 'PENDING_APPROVAL',
      };

      vi.spyOn(dbService, 'get').mockResolvedValue(mockRec);
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const rejected = await reconciliationService.rejectReconciliation(
        'ten_1',
        'rec_rej_1',
        'Incorrect customer party'
      );

      expect(rejected.status).toBe('REJECTED');
      expect(updateSpy).toHaveBeenCalledWith(
        'reconciliations/ten_1/rec_rej_1',
        expect.objectContaining({
          status: 'REJECTED',
          notes: 'Incorrect customer party',
        })
      );
    });
  });

  describe('simulateProcessTallyVouchers', () => {
    it('should process QUEUED commands, generate Tally voucher numbers, and mark COMPLETED and SYNCED', async () => {
      const mockCommands = {
        cmd_1: {
          commandId: 'cmd_1',
          tenantId: 'ten_1',
          reconciliationId: 'rec_10',
          amount: 50000,
          status: 'QUEUED',
          partyLedger: 'Bharat Traders',
          billsAllocated: [{ billNumber: 'INV-10', billAmount: 50000 }],
        },
      };

      vi.spyOn(dbService, 'get').mockResolvedValue(mockCommands);
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const res = await reconciliationService.simulateProcessTallyVouchers('ten_1');

      expect(res.processedCount).toBe(1);
      expect(res.vouchers[0].status).toBe('COMPLETED');
      expect(res.vouchers[0].tallyVoucherNumber).toMatch(/^RC-\d{4}-\d+/);

      // Verifies reconciliation was marked SYNCED
      expect(updateSpy).toHaveBeenCalledWith(
        'reconciliations/ten_1/rec_10',
        expect.objectContaining({
          tallyWriteBackStatus: 'SYNCED',
          tallyVoucherNumber: expect.stringMatching(/^RC-/),
        })
      );
    });
  });
});
