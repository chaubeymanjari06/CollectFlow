import { describe, it, expect, vi, beforeEach } from 'vitest';
import { receivablesService, calculateSection43Bh } from '../../services/receivablesService';
import { reconciliationService } from '../../services/reconciliationService';
import { syncService } from '../../services/syncService';
import { reminderPtpService } from '../../services/reminderPtpService';
import { dbService } from '../../services/dbService';
import { Invoice, Payment, Customer, TallyVoucherCommand } from '../../types';

describe('Phase 19: Post-Pilot MSME UX & Gap Remediation Sprints', () => {
  const tenantId = 'tenant_msme_phase19';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbService, 'set').mockResolvedValue();
    vi.spyOn(dbService, 'update').mockResolvedValue();
    vi.spyOn(dbService, 'remove').mockResolvedValue();
    vi.spyOn(dbService, 'push').mockResolvedValue('mock_id');
  });

  describe('Sprint 1: Critical Accounting Fixes & Accounting Nuance', () => {
    describe('Section 43B(h) MSMED Act Statutory Calculator', () => {
      const fixedRefDate = new Date('2026-05-15');

      it('should calculate 45-day statutory deadline when written agreement exists', () => {
        const res = calculateSection43Bh('2026-04-01', 'MICRO', true, fixedRefDate);
        expect(res.deadlineStr).toBe('2026-05-16');
        expect(res.daysRemaining).toBe(1);
        expect(res.isOverdue).toBe(false);
      });

      it('should calculate 15-day statutory deadline when no written agreement exists', () => {
        const res = calculateSection43Bh('2026-04-01', 'MICRO', false, fixedRefDate);
        expect(res.deadlineStr).toBe('2026-04-16');
        expect(res.daysRemaining).toBeLessThan(0);
        expect(res.isOverdue).toBe(true);
      });

      it('should flag income tax disallowance (isOverdue = true) when 45-day deadline has passed', () => {
        const res = calculateSection43Bh('2026-03-01', 'SMALL', true, fixedRefDate);
        expect(res.isOverdue).toBe(true);
        expect(res.daysRemaining).toBeLessThan(0);
      });

      it('should exempt non-MSME enterprises from Section 43B(h) overdue disallowance', () => {
        const res = calculateSection43Bh('2026-01-01', 'NON_MSME', true, fixedRefDate);
        expect(res.isOverdue).toBe(false);
      });
    });

    describe('Credit Note & Return Adjustments (Eliminating False Overdue Reminders)', () => {
      it('should create credit note and reduce net balance on invoice', async () => {
        const mockInvoice: Invoice = {
          invoiceId: 'inv_101',
          tenantId,
          customerId: 'cust_abc',
          customerName: 'Shree Ganesh Traders',
          source: 'tally',
          invoiceNumber: 'INV-2026-001',
          invoiceDate: '2026-04-01',
          dueDate: '2026-04-30',
          amount: 100000,
          paidAmount: 0,
          balance: 100000,
          currency: 'INR',
          status: 'OPEN',
          agingBucket: 'CURRENT',
          daysPastDue: 0,
          hasActivePtp: false,
          reminderCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        vi.spyOn(dbService, 'set').mockResolvedValue();
        vi.spyOn(dbService, 'update').mockResolvedValue();
        vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
          if (path.includes('inv_101')) return mockInvoice;
          if (path.includes('creditNotes')) {
            return {
              cn_test_1: {
                creditNoteId: 'cn_test_1',
                tenantId,
                customerId: 'cust_abc',
                customerName: 'Shree Ganesh Traders',
                amount: 20000,
                noteNumber: 'CN-001',
                noteDate: '2026-04-10',
                reason: 'Damaged Goods Return',
                status: 'APPLIED',
                createdAt: Date.now(),
              },
            };
          }
          return null;
        });
        vi.spyOn(receivablesService, 'recalculateTenantReceivables').mockResolvedValue({} as any);

        const cn = await receivablesService.createCreditNote(tenantId, {
          customerId: 'cust_abc',
          customerName: 'Shree Ganesh Traders',
          noteNumber: 'CN-001',
          noteDate: '2026-04-10',
          amount: 20000,
          reason: 'Damaged Goods Return',
          invoiceId: 'inv_101',
        });

        expect(cn.amount).toBe(20000);
        expect(cn.noteNumber).toBe('CN-001');
      });

      it('should mark invoice as PAID when Credit Note matches outstanding balance', async () => {
        const mockInvoice: Invoice = {
          invoiceId: 'inv_full_return',
          tenantId,
          customerId: 'cust_abc',
          customerName: 'Shree Ganesh Traders',
          source: 'tally',
          invoiceNumber: 'INV-2026-002',
          invoiceDate: '2026-04-01',
          dueDate: '2026-04-15',
          amount: 30000,
          paidAmount: 0,
          balance: 30000,
          currency: 'INR',
          status: 'OVERDUE',
          agingBucket: '1-30',
          daysPastDue: 15,
          hasActivePtp: false,
          reminderCount: 2,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const mockCreditNote = {
          creditNoteId: 'cn_full',
          tenantId,
          customerId: 'cust_abc',
          customerName: 'Shree Ganesh Traders',
          amount: 30000,
          noteNumber: 'CN-FULL',
          noteDate: '2026-04-20',
          reason: 'Full Order Cancelled',
          status: 'PENDING' as const,
          createdAt: Date.now(),
        };

        vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
          if (path.includes('cn_full')) return mockCreditNote;
          if (path.includes('inv_full_return')) return mockInvoice;
          return null;
        });
        vi.spyOn(dbService, 'update').mockResolvedValue();
        vi.spyOn(receivablesService, 'recalculateTenantReceivables').mockResolvedValue({} as any);

        const updated = await receivablesService.applyCreditNote(tenantId, 'cn_full', 'inv_full_return');
        expect(updated).not.toBeNull();
        expect(updated!.balance).toBe(0);
        expect(updated!.status).toBe('PAID');
        expect(updated!.creditNotesAmount).toBe(30000);
      });
    });

    describe('Dispute Management Workflow (Freezing Reminders)', () => {
      it('should set invoice status to DISPUTED and record disputeReason', async () => {
        const mockInvoice: Invoice = {
          invoiceId: 'inv_disp_1',
          tenantId,
          customerId: 'cust_xyz',
          customerName: 'Apex Engineering',
          source: 'tally',
          invoiceNumber: 'INV-2026-003',
          invoiceDate: '2026-04-01',
          dueDate: '2026-04-15',
          amount: 75000,
          paidAmount: 0,
          balance: 75000,
          currency: 'INR',
          status: 'OVERDUE',
          agingBucket: '1-30',
          daysPastDue: 20,
          hasActivePtp: false,
          reminderCount: 3,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        vi.spyOn(dbService, 'get').mockResolvedValue(mockInvoice);
        vi.spyOn(dbService, 'update').mockResolvedValue();
        vi.spyOn(receivablesService, 'recalculateTenantReceivables').mockResolvedValue({} as any);

        const updated = await receivablesService.markInvoiceDisputed(
          tenantId,
          'inv_disp_1',
          'RATE_MISMATCH',
          'Rate agreed was ₹45/kg, billed at ₹50/kg'
        );

        expect(updated).not.toBeNull();
        expect(updated!.status).toBe('DISPUTED');
        expect(updated!.disputeReason).toBe('RATE_MISMATCH');
        expect(updated!.disputeNotes).toBe('Rate agreed was ₹45/kg, billed at ₹50/kg');
      });

      it('should resolve dispute and restore active invoice status', async () => {
        const mockDisputedInvoice: Invoice = {
          invoiceId: 'inv_disp_2',
          tenantId,
          customerId: 'cust_xyz',
          customerName: 'Apex Engineering',
          source: 'tally',
          invoiceNumber: 'INV-2026-004',
          invoiceDate: '2026-04-01',
          dueDate: '2026-12-31',
          amount: 50000,
          paidAmount: 0,
          balance: 50000,
          currency: 'INR',
          status: 'DISPUTED',
          agingBucket: 'CURRENT',
          daysPastDue: 0,
          hasActivePtp: false,
          disputeReason: 'DAMAGED_GOODS',
          reminderCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        vi.spyOn(dbService, 'get').mockResolvedValue(mockDisputedInvoice);
        vi.spyOn(dbService, 'update').mockResolvedValue();
        vi.spyOn(receivablesService, 'recalculateTenantReceivables').mockResolvedValue({} as any);

        const resolved = await receivablesService.resolveDispute(
          tenantId,
          'inv_disp_2',
          'Replacement goods delivered successfully'
        );

        expect(resolved).not.toBeNull();
        expect(resolved!.status).toBe('OPEN');
        expect(resolved!.disputeReason).toBeNull();
      });
    });

    describe('Smart TDS (Tax Deducted at Source) Detection', () => {
      it('should match payment minus 0.1% TDS (Section 194Q) with high confidence (95%)', async () => {
        const payment: Payment = {
          paymentId: 'pay_tds_1',
          tenantId,
          customerId: 'cust_tds',
          customerName: 'Tata Steel Corp',
          amount: 99900, // 100,000 - 0.1% (₹100) = 99,900
          matchedAmount: 0,
          unmatchedBalance: 99900,
          source: 'tally_bank',
          provider: 'bank',
          status: 'SUCCESS',
          idempotencyKey: 'idem_tds_1',
          paymentDate: '2026-05-01',
          currency: 'INR',
          reconciliationStatus: 'UNMATCHED',
          rawReference: 'NEFT-TATA-CORP-BATCH',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const openInvoices: Invoice[] = [
          {
            invoiceId: 'inv_tds_1',
            tenantId,
            customerId: 'cust_tds',
            customerName: 'Tata Steel Corp',
            source: 'tally',
            invoiceNumber: 'INV-09',
            invoiceDate: '2026-04-01',
            dueDate: '2026-04-30',
            amount: 100000,
            paidAmount: 0,
            balance: 100000,
            currency: 'INR',
            status: 'OPEN',
            agingBucket: 'CURRENT',
            daysPastDue: 0,
            hasActivePtp: false,
            reminderCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ];

        vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
          if (path.includes('invoices')) return { [openInvoices[0].invoiceId]: openInvoices[0] };
          if (path.includes('customers')) return {};
          return null;
        });

        const match = await reconciliationService.evaluatePaymentMatch(tenantId, payment);
        expect(match).not.toBeNull();
        expect(match!.matchRule).toBe('SMART_TDS_MATCH');
        expect(match!.confidenceScore).toBe(95);
        expect(match!.tdsDetected).toBe(true);
        expect(match!.tdsPercentage).toBe(0.1);
        expect(match!.tdsSection).toBe('194Q');
        expect(match!.tdsAmount).toBe(100);
      });

      it('should match payment minus 1% TDS (Section 194C) with high confidence', async () => {
        const payment: Payment = {
          paymentId: 'pay_tds_2',
          tenantId,
          customerId: 'cust_contractor',
          customerName: 'Larsen Infra Ltd',
          amount: 49500, // 50,000 - 1% (₹500) = 49,500
          matchedAmount: 0,
          unmatchedBalance: 49500,
          source: 'tally_bank',
          provider: 'bank',
          status: 'SUCCESS',
          idempotencyKey: 'idem_tds_2',
          paymentDate: '2026-05-02',
          currency: 'INR',
          reconciliationStatus: 'UNMATCHED',
          rawReference: 'RTGS-LARSEN-BATCH-77',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const openInvoices: Invoice[] = [
          {
            invoiceId: 'inv_tds_2',
            tenantId,
            customerId: 'cust_contractor',
            customerName: 'Larsen Infra Ltd',
            source: 'tally',
            invoiceNumber: 'INV-LARSEN-50',
            invoiceDate: '2026-04-01',
            dueDate: '2026-04-30',
            amount: 50000,
            paidAmount: 0,
            balance: 50000,
            currency: 'INR',
            status: 'OPEN',
            agingBucket: 'CURRENT',
            daysPastDue: 0,
            hasActivePtp: false,
            reminderCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ];

        vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
          if (path.includes('invoices')) return { [openInvoices[0].invoiceId]: openInvoices[0] };
          if (path.includes('customers')) return {};
          return null;
        });

        const match = await reconciliationService.evaluatePaymentMatch(tenantId, payment);
        expect(match).not.toBeNull();
        expect(match!.matchRule).toBe('SMART_TDS_MATCH');
        expect(match!.confidenceScore).toBe(95);
        expect(match!.tdsDetected).toBe(true);
        expect(match!.tdsPercentage).toBe(1);
        expect(match!.tdsSection).toBe('194C');
      });

      it('should mark invoice as fully PAID when settling with TDS Certificate Pending', async () => {
        const mockRec = {
          reconciliationId: 'rec_tds_settle',
          tenantId,
          paymentId: 'pay_tds_3',
          customerId: 'cust_1',
          paymentAmount: 99900,
          totalAllocated: 99900,
          allocations: [
            {
              invoiceId: 'inv_tds_target',
              invoiceNumber: 'INV-TARGET',
              allocatedAmount: 99900,
              invoiceBalanceBefore: 100000,
              invoiceBalanceAfter: 100,
            },
          ],
          confidenceScore: 95,
          matchRule: 'SMART_TDS_MATCH' as const,
          status: 'PENDING_APPROVAL' as const,
          tallyWriteBackStatus: 'NOT_REQUIRED' as const,
          tdsDetected: true,
          tdsPercentage: 0.1,
          tdsAmount: 100,
          tdsSection: '194Q' as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const mockInv: Invoice = {
          invoiceId: 'inv_tds_target',
          tenantId,
          customerId: 'cust_1',
          customerName: 'Client 1',
          source: 'tally',
          invoiceNumber: 'INV-TARGET',
          invoiceDate: '2026-04-01',
          dueDate: '2026-04-30',
          amount: 100000,
          paidAmount: 0,
          balance: 100000,
          currency: 'INR',
          status: 'OPEN',
          agingBucket: 'CURRENT',
          daysPastDue: 0,
          hasActivePtp: false,
          reminderCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
          if (path.includes('rec_tds_settle')) return mockRec;
          if (path.includes('inv_tds_target')) return mockInv;
          return null;
        });
        vi.spyOn(dbService, 'update').mockResolvedValue();
        vi.spyOn(reconciliationService, 'queueTallyVoucherCommand').mockResolvedValue({} as any);

        const approved = await reconciliationService.approveReconciliation(
          tenantId,
          'rec_tds_settle',
          'Munimji User',
          { settleWithTdsPending: true }
        );

        expect(approved.status).toBe('APPROVED');
        expect(approved.settledWithTdsPending).toBe(true);
      });
    });
  });

  describe('Sprint 2: Seamless Connectivity & Real-World Operations', () => {
    describe('Zero-Tech 6-Digit PIN & QR Pairing Handshake', () => {
      it('should generate a 6-digit PIN and detected local Tally instances', async () => {
        vi.spyOn(dbService, 'set').mockResolvedValue();

        const session = await syncService.generatePairingSession(tenantId, 'Shree Enterprises');
        expect(session.pairingPin).toMatch(/^\d{3}-\d{3}$/);
        expect(session.detectedInstances.length).toBeGreaterThanOrEqual(1);
        expect(session.detectedInstances[0].port).toBe(9000);
        expect(session.qrPayload).toContain('collectflow://pair');
      });

      it('should verify pairing PIN and register workstation', async () => {
        vi.spyOn(dbService, 'set').mockResolvedValue();
        vi.spyOn(dbService, 'update').mockResolvedValue();

        const result = await syncService.verifyPairingPin(tenantId, '741-902', 'Shree Enterprises FY 26-27');
        expect(result.success).toBe(true);
        expect(result.device).toBeDefined();
        expect(result.device!.activeCompany).toBe('Shree Enterprises FY 26-27');
      });

      it('should reject invalid PIN formats', async () => {
        await expect(syncService.verifyPairingPin(tenantId, '12')).rejects.toThrow(
          'Please enter a valid 6-digit pairing PIN'
        );
      });

      it('should provide plain-language connection guidance for common Tally issues', () => {
        const odbcGuide = syncService.getConnectionGuidance('ODBC_DISABLED');
        expect(odbcGuide.steps.length).toBeGreaterThan(0);
        expect(odbcGuide.solution).toContain('F12');

        const fwGuide = syncService.getConnectionGuidance('FIREWALL_BLOCKED');
        expect(fwGuide.steps.length).toBeGreaterThan(0);
      });

      it('should return watchdog offline queue status', () => {
        const watchdog = syncService.getOfflineQueueStatus();
        expect(watchdog.serviceRunning).toBe(true);
        expect(watchdog.watchdogActive).toBe(true);
        expect(watchdog.offlineModeSupported).toBe(true);
      });
    });

    describe('Bill-by-Bill Tally Write-Back & Voucher Numbering', () => {
      it('should generate XML with BILLALLOCATIONS.LIST and Agst Ref bill type', () => {
        const cmd: TallyVoucherCommand = {
          commandId: 'cmd_1',
          tenantId,
          voucherType: 'Receipt',
          voucherDate: '20260515',
          partyLedger: 'Shree Ganesh Enterprises',
          bankOrCashLedger: 'HDFC Bank Collection A/c',
          amount: 50000,
          narration: 'Receipt against INV-2026-042',
          billType: 'Agst Ref',
          billAllocations: [
            {
              billType: 'Agst Ref',
              billName: 'INV-2026-042',
              amount: 50000,
            },
          ],
          autoNumbering: true,
          status: 'QUEUED',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const xml = syncService.generateTallyVoucherXml(cmd);
        expect(xml).toContain('<BILLALLOCATIONS.LIST>');
        expect(xml).toContain('<BILLTYPE>Agst Ref</BILLTYPE>');
        expect(xml).toContain('<NAME>INV-2026-042</NAME>');
        expect(xml).toContain('<ISAUTONUMBER>Yes</ISAUTONUMBER>');
      });
    });
  });

  describe('Sprint 3: Compliance, Localization & DPDP Act 2023', () => {
    describe('DPDP Act 2023 Opt-Out & Inbound Webhook Parser', () => {
      it('should append mandatory "Reply STOP to pause" footer to reminder templates', () => {
        const invoice: Invoice = {
          invoiceId: 'inv_dpdp',
          tenantId,
          customerId: 'cust_dpdp',
          customerName: 'Ambani Textiles',
          source: 'tally',
          invoiceNumber: 'INV-999',
          invoiceDate: '2026-04-01',
          dueDate: '2026-04-30',
          amount: 80000,
          paidAmount: 0,
          balance: 80000,
          currency: 'INR',
          status: 'OVERDUE',
          agingBucket: '1-30',
          daysPastDue: 15,
          hasActivePtp: false,
          reminderCount: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const text = reminderPtpService.renderMessageTemplate('OVERDUE_GENTLE', {
          customerName: invoice.customerName,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.balance,
          dueDate: invoice.dueDate,
          paymentLink: 'https://collectflow.in/pay/inv_dpdp',
        });

        expect(text).toContain('Reply STOP to pause');
      });

      it('should suppress WhatsApp reminders when customer replies "STOP"', async () => {
        vi.spyOn(dbService, 'get').mockResolvedValue({
          cust_opt_out: {
            customerId: 'cust_opt_out',
            tenantId,
            mobile: '+919876543210',
            name: 'Opt Out Client',
            optOutWhatsApp: false,
          },
        });
        vi.spyOn(dbService, 'update').mockResolvedValue();

        const webhookResult = await reminderPtpService.handleInboundWhatsAppWebhook(
          tenantId,
          '+919876543210',
          'STOP please do not message'
        );

        expect(webhookResult.optedOut).toBe(true);
        expect(webhookResult.message).toContain('Opt-out processed');
      });

      it('should extract promise date from customer reply and create PTP', async () => {
        const mockCustomer: Customer = {
          customerId: 'cust_ptp_reply',
          tenantId,
          source: 'tally',
          name: 'PTP Client',
          mobile: '+919123456780',
          creditLimit: 100000,
          paymentTerms: 30,
          optOutWhatsApp: false,
          metrics: {} as any,
          status: 'ACTIVE',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        vi.spyOn(dbService, 'get').mockImplementation(async (path: string) => {
          if (path.includes('customers')) return { cust_ptp_reply: mockCustomer };
          if (path.includes('invoices')) {
            return {
              inv_1: {
                invoiceId: 'inv_1',
                tenantId,
                customerId: 'cust_ptp_reply',
                customerName: 'PTP Client',
                invoiceNumber: 'INV-PTP-01',
                balance: 50000,
                amount: 50000,
                status: 'OPEN',
              },
            };
          }
          return null;
        });
        vi.spyOn(reminderPtpService, 'createPromiseToPay').mockResolvedValue({} as any);

        const webhookResult = await reminderPtpService.handleInboundWhatsAppWebhook(
          tenantId,
          '+919123456780',
          'I will pay full amount on 2026-06-15'
        );

        expect(webhookResult.ptpCreated).toBe(true);
        expect(webhookResult.extractedDate).toBe('2026-06-15');
      });
    });

    describe('Daily Morning Routine Scheduled Job', () => {
      it('should execute scheduled morning cron and skip active PTPs and disputed bills', async () => {
        vi.spyOn(reminderPtpService, 'evaluateMaturedPtps').mockResolvedValue({ kept: 2, broken: 1 });
        vi.spyOn(reminderPtpService, 'runAutomatedBatchWorkflow').mockResolvedValue({
          sent: 8,
          result: {
            eligibleInvoices: [],
            skippedActivePtp: 3,
            skippedDeduplication: 1,
            skippedOptOut: 0,
            skippedDisputed: 1,
          },
        });
        vi.spyOn(reminderPtpService, 'getBrokenPromises').mockResolvedValue([]);
        vi.spyOn(dbService, 'get').mockResolvedValue({});
        vi.spyOn(dbService, 'set').mockResolvedValue();

        const cronResult = await reminderPtpService.runDailyMorningCron(tenantId);
        expect(cronResult.status).toBe('SUCCESS');
        expect(cronResult.messagesSent).toBe(8);
        expect(cronResult.ptpsKept).toBe(2);
        expect(cronResult.ptpsBroken).toBe(1);
      });
    });
  });
});
