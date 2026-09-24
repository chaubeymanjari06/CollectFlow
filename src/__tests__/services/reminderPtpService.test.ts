import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reminderPtpService } from '../../services/reminderPtpService';
import { dbService } from '../../services/dbService';

describe('WhatsApp Collection & Promise-to-Pay Engine (Phase 5 & 6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createPromiseToPay', () => {
    it('should create PTP record, pause reminders on linked invoice, and log confirmation message', async () => {
      const setSpy = vi.spyOn(dbService, 'set').mockResolvedValue(undefined);
      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);
      vi.spyOn(dbService, 'get').mockResolvedValue({ activePtpCount: 2 });

      const promise = await reminderPtpService.createPromiseToPay('ten_1', {
        customerId: 'cust_10',
        customerName: 'Anand Enterprises',
        invoiceIds: ['inv_100'],
        invoiceNumber: 'INV-100',
        amount: 45000,
        promisedDate: '2026-10-15',
        notes: 'Promised transfer via NEFT',
      });

      expect(promise.promiseId).toMatch(/^ptp_/);
      expect(promise.status).toBe('PENDING');
      expect(promise.amount).toBe(45000);

      // Verifies PTP persisted in Realtime Database
      expect(setSpy).toHaveBeenCalledWith(
        expect.stringContaining('promises/ten_1/ptp_'),
        expect.objectContaining({ status: 'PENDING', amount: 45000 })
      );

      // Verifies invoice updated to pause reminders
      expect(updateSpy).toHaveBeenCalledWith('invoices/ten_1/inv_100', {
        hasActivePtp: true,
        activePtpId: promise.promiseId,
      });

      // Verifies confirmation message generated
      expect(setSpy).toHaveBeenCalledWith(
        expect.stringContaining('messages/ten_1/msg_'),
        expect.objectContaining({ templateId: 'ptp_confirmation' })
      );
    });
  });

  describe('evaluateMaturedPtps', () => {
    it('should mark promise as KEPT if invoice is paid, and clear hasActivePtp flag', async () => {
      const mockPromises = {
        ptp_1: {
          promiseId: 'ptp_1',
          tenantId: 'ten_1',
          invoiceIds: ['inv_1'],
          amount: 50000,
          promisedDate: '2026-09-20',
          status: 'PENDING',
        },
      };

      const mockInvoices = {
        inv_1: { invoiceId: 'inv_1', balance: 0 }, // Paid!
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'promises/ten_1') return mockPromises as any;
        if (path === 'invoices/ten_1') return mockInvoices as any;
        return null;
      });

      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const { kept, broken } = await reminderPtpService.evaluateMaturedPtps('ten_1');

      expect(kept).toBe(1);
      expect(broken).toBe(0);
      expect(updateSpy).toHaveBeenCalledWith('promises/ten_1/ptp_1', expect.objectContaining({ status: 'KEPT' }));
      expect(updateSpy).toHaveBeenCalledWith('invoices/ten_1/inv_1', { hasActivePtp: false, activePtpId: null });
    });

    it('should mark promise as BROKEN if date passed and balance remains', async () => {
      const mockPromises = {
        ptp_2: {
          promiseId: 'ptp_2',
          tenantId: 'ten_1',
          invoiceIds: ['inv_2'],
          amount: 50000,
          promisedDate: '2026-08-01', // Date in the past
          status: 'PENDING',
        },
      };

      const mockInvoices = {
        inv_2: { invoiceId: 'inv_2', balance: 50000 }, // Still unpaid
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'promises/ten_1') return mockPromises as any;
        if (path === 'invoices/ten_1') return mockInvoices as any;
        return null;
      });

      const updateSpy = vi.spyOn(dbService, 'update').mockResolvedValue(undefined);

      const { kept, broken } = await reminderPtpService.evaluateMaturedPtps('ten_1');

      expect(kept).toBe(0);
      expect(broken).toBe(1);
      expect(updateSpy).toHaveBeenCalledWith('promises/ten_1/ptp_2', expect.objectContaining({ status: 'BROKEN' }));
    });
  });

  describe('evaluateWorkflow', () => {
    it('should apply deduplication, active PTP pause, and opt-out rules', async () => {
      const now = Date.now();
      const mockCustomers = {
        cust_active: { customerId: 'cust_active', name: 'Active Customer', mobile: '+919999999999', optOutWhatsApp: false },
        cust_optout: { customerId: 'cust_optout', name: 'Opted Out Customer', mobile: '+918888888888', optOutWhatsApp: true },
      };

      const mockInvoices = {
        inv_eligible: {
          invoiceId: 'inv_eligible',
          customerId: 'cust_active',
          invoiceNumber: 'INV-ELIGIBLE',
          dueDate: '2026-09-01', // Overdue
          balance: 30000,
          status: 'OVERDUE',
          hasActivePtp: false,
          lastReminderSentAt: null,
        },
        inv_ptp_paused: {
          invoiceId: 'inv_ptp_paused',
          customerId: 'cust_active',
          invoiceNumber: 'INV-PTP',
          dueDate: '2026-09-01',
          balance: 40000,
          status: 'OVERDUE',
          hasActivePtp: true, // Should be skipped!
          lastReminderSentAt: null,
        },
        inv_recent: {
          invoiceId: 'inv_recent',
          customerId: 'cust_active',
          invoiceNumber: 'INV-RECENT',
          dueDate: '2026-09-01',
          balance: 20000,
          status: 'OVERDUE',
          hasActivePtp: false,
          lastReminderSentAt: now - 3600000, // Sent 1 hour ago (deduplication window)!
        },
        inv_opted_out: {
          invoiceId: 'inv_opted_out',
          customerId: 'cust_optout',
          invoiceNumber: 'INV-OPTOUT',
          dueDate: '2026-09-01',
          balance: 15000,
          status: 'OVERDUE',
          hasActivePtp: false,
          lastReminderSentAt: null,
        },
      };

      vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
        if (path === 'invoices/ten_1') return mockInvoices as any;
        if (path === 'customers/ten_1') return mockCustomers as any;
        return null;
      });

      const res = await reminderPtpService.evaluateWorkflow('ten_1');

      expect(res.eligibleInvoices.length).toBe(1);
      expect(res.eligibleInvoices[0].invoice.invoiceId).toBe('inv_eligible');
      expect(res.eligibleInvoices[0].templateId).toBe('overdue_reminder');
      expect(res.skippedActivePtp).toBe(1);
      expect(res.skippedDeduplication).toBe(1);
      expect(res.skippedOptOut).toBe(1);
    });
  });
});
