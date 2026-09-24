import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paymentService } from '../../services/paymentService';
import { dbService } from '../../services/dbService';

describe('Payment Ingestion & Management Engine (Phase 7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ingestPayment', () => {
    it('should save a new payment and create an idempotency key record', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const result = await paymentService.ingestPayment('ten_abc', {
        customerId: 'cust_1',
        customerName: 'Bharat Traders',
        source: 'razorpay',
        provider: 'razorpay',
        amount: 25000,
        utr: 'UTR99887766',
        idempotencyKey: 'idem_unique_123',
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.payment.paymentId).toMatch(/^pay_/);
      expect(result.payment.amount).toBe(25000);
      expect(result.payment.reconciliationStatus).toBe('UNMATCHED');
      expect(result.payment.unmatchedBalance).toBe(25000);

      expect(setSpy).toHaveBeenCalledWith(
        expect.stringContaining('payments/ten_abc/pay_'),
        expect.objectContaining({
          amount: 25000,
          idempotencyKey: 'idem_unique_123',
        })
      );
      expect(setSpy).toHaveBeenCalledWith(
        'idempotencyKeys/ten_abc/idem_unique_123',
        expect.objectContaining({
          paymentId: result.payment.paymentId,
        })
      );
    });

    it('should return existing payment when duplicate idempotency key is submitted', async () => {
      const existingPayment = {
        paymentId: 'pay_existing_123',
        tenantId: 'ten_abc',
        amount: 50000,
        idempotencyKey: 'idem_existing_key',
        reconciliationStatus: 'UNMATCHED',
        unmatchedBalance: 50000,
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'idempotencyKeys/ten_abc/idem_existing_key') {
          return { paymentId: 'pay_existing_123' };
        }
        if (path === 'payments/ten_abc/pay_existing_123') {
          return existingPayment;
        }
        return null;
      });

      const setSpy = vi.spyOn(dbService, 'set');

      const result = await paymentService.ingestPayment('ten_abc', {
        amount: 50000,
        source: 'cashfree',
        provider: 'cashfree',
        idempotencyKey: 'idem_existing_key',
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.payment.paymentId).toBe('pay_existing_123');
      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe('updatePaymentReconciliation', () => {
    it('should update matchedAmount and transition status to PARTIALLY_MATCHED', async () => {
      const mockPayment = {
        paymentId: 'pay_100',
        tenantId: 'ten_abc',
        amount: 10000,
        matchedAmount: 0,
        unmatchedBalance: 10000,
        reconciliationStatus: 'UNMATCHED',
      };

      vi.spyOn(dbService, 'get').mockResolvedValue(mockPayment);
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const updated = await paymentService.updatePaymentReconciliation('ten_abc', 'pay_100', 4000);

      expect(updated?.matchedAmount).toBe(4000);
      expect(updated?.unmatchedBalance).toBe(6000);
      expect(updated?.reconciliationStatus).toBe('PARTIALLY_MATCHED');

      expect(updateSpy).toHaveBeenCalledWith('payments/ten_abc/pay_100', {
        matchedAmount: 4000,
        unmatchedBalance: 6000,
        reconciliationStatus: 'PARTIALLY_MATCHED',
        updatedAt: expect.any(Number),
      });
    });

    it('should transition status to FULLY_MATCHED when entire amount is matched', async () => {
      const mockPayment = {
        paymentId: 'pay_100',
        tenantId: 'ten_abc',
        amount: 10000,
        matchedAmount: 6000,
        unmatchedBalance: 4000,
        reconciliationStatus: 'PARTIALLY_MATCHED',
      };

      vi.spyOn(dbService, 'get').mockResolvedValue(mockPayment);
      vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const updated = await paymentService.updatePaymentReconciliation('ten_abc', 'pay_100', 4000);

      expect(updated?.matchedAmount).toBe(10000);
      expect(updated?.unmatchedBalance).toBe(0);
      expect(updated?.reconciliationStatus).toBe('FULLY_MATCHED');
    });
  });

  describe('simulateGatewayWebhook and recordManualReceipt', () => {
    it('should format webhook payload and ingest payment with provider details', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);
      vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const result = await paymentService.simulateGatewayWebhook('ten_abc', {
        provider: 'razorpay',
        invoiceReference: 'INV-2026-0042',
        amount: 35000,
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.payment.provider).toBe('razorpay');
      expect(result.payment.providerOrderId).toBe('order_INV-2026-0042');
      expect(result.payment.rawReference).toContain('INV-2026-0042');
      expect(result.payment.amount).toBe(35000);
    });

    it('should record manual bank receipt with manual source', async () => {
      vi.spyOn(dbService, 'get').mockResolvedValue(null);
      vi.spyOn(dbService, 'set').mockResolvedValue(undefined);

      const result = await paymentService.recordManualReceipt('ten_abc', {
        customerId: 'cust_9',
        customerName: 'Shree Cement Agency',
        amount: 75000,
        paymentDate: '2026-09-24',
        utr: 'NEFT-AXIS-992211',
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.payment.source).toBe('manual');
      expect(result.payment.provider).toBe('bank');
      expect(result.payment.utr).toBe('NEFT-AXIS-992211');
      expect(result.payment.amount).toBe(75000);
    });
  });
});
